// Proxy to forward requests to Gemini API (avoids CORS and hides API key)
// Usage: node server/proxy.js

import http from "http";
import https from "https";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { StringDecoder } from "string_decoder";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load API key from .env file
let GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  const match = envContent.match(/GEMINI_API_KEY=(.+)/);
  if (match) GEMINI_KEY = match[1].trim();
}

if (!GEMINI_KEY) {
  console.error("\n❌ No GEMINI_API_KEY found!");
  console.error("   Create a .env file with: GEMINI_API_KEY=AIza...\n");
  process.exit(1);
}

const DEFAULT_MODEL = "gemini-flash-latest";
const ALLOWED_MODELS = new Set([
  "gemini-flash-latest",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
]);

// === Rate Limiting ===
const RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 30,
  dailyMax: 500,
};

const requestLog = [];
let dailyCount = 0;
let dailyResetTime = Date.now() + 24 * 60 * 60 * 1000;

function isRateLimited() {
  const now = Date.now();
  if (now > dailyResetTime) {
    dailyCount = 0;
    dailyResetTime = now + 24 * 60 * 60 * 1000;
  }
  if (dailyCount >= RATE_LIMIT.dailyMax) {
    return { limited: true, reason: `Daily limit reached (${RATE_LIMIT.dailyMax} requests). Resets in ${Math.ceil((dailyResetTime - now) / 3600000)}h.` };
  }
  const windowStart = now - RATE_LIMIT.windowMs;
  while (requestLog.length > 0 && requestLog[0] < windowStart) {
    requestLog.shift();
  }
  if (requestLog.length >= RATE_LIMIT.maxRequests) {
    const retryAfter = Math.ceil((requestLog[0] + RATE_LIMIT.windowMs - now) / 1000);
    return { limited: true, reason: `Too many requests. Try again in ${retryAfter}s. (${RATE_LIMIT.maxRequests}/min limit)` };
  }
  return { limited: false };
}

function recordRequest() {
  requestLog.push(Date.now());
  dailyCount++;
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Rate limit status endpoint
  if (req.method === "GET" && req.url === "/api/rate-limit-status") {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.windowMs;
    const recentRequests = requestLog.filter(t => t >= windowStart).length;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      minuteUsed: recentRequests,
      minuteLimit: RATE_LIMIT.maxRequests,
      dailyUsed: dailyCount,
      dailyLimit: RATE_LIMIT.dailyMax,
    }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/gemini") {
    const rateCheck = isRateLimited();
    if (rateCheck.limited) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: rateCheck.reason }));
      return;
    }

    // Collect raw bytes; decode once at end so multi-byte UTF-8 (Chinese, em-dashes, emoji)
    // never gets split across packet boundaries.
    const bodyChunks = [];
    req.on("data", (chunk) => bodyChunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(bodyChunks).toString("utf8");
      recordRequest();

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      const { system, message, maxTokens = 1000, thinkingBudget, useSearch } = parsed;
      // Accept model from request body, validate against whitelist
      const MODEL = (parsed.model && ALLOWED_MODELS.has(parsed.model)) ? parsed.model : DEFAULT_MODEL;
      console.log(`[Request] model=${MODEL} maxTokens=${maxTokens}${thinkingBudget ? ` thinkBudget=${thinkingBudget}` : ""}${useSearch ? " +search" : ""} system_len=${(system || "").length} msg_len=${(message || "").length}`);

      // Build Gemini request body
      const genConfig = { maxOutputTokens: maxTokens };
      if (thinkingBudget && !useSearch) {
        // Disable thinking for search requests — thinking causes model to skip Google Search
        genConfig.thinkingConfig = { thinkingBudget };
      }
      const geminiReq = {
        system_instruction: { parts: [{ text: system || "" }] },
        contents: [{ role: "user", parts: [{ text: message || "" }] }],
        generationConfig: genConfig,
      };
      if (useSearch) {
        geminiReq.tools = [{ google_search: {} }];
      }
      const geminiBody = JSON.stringify(geminiReq);

      const postData = Buffer.from(geminiBody);
      const useStream = parsed.stream !== false;

      if (useStream) {
        // === Streaming mode: stream tokens to client in real-time ===
        const streamPath = `/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`;
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });

        const callStream = (attempt) => {
          const opts = {
            hostname: "generativelanguage.googleapis.com",
            path: streamPath,
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": postData.length },
          };

          const proxyReq = https.request(opts, (proxyRes) => {
            if (proxyRes.statusCode >= 400) {
              const errChunks = [];
              proxyRes.on("data", c => errChunks.push(c));
              proxyRes.on("end", () => {
                const errBody = Buffer.concat(errChunks).toString("utf8");
                console.error(`[Gemini ${proxyRes.statusCode}]`, errBody.slice(0, 500));
                if (attempt < 2) {
                  console.log(`[Retry] attempt ${attempt + 1}...`);
                  callStream(attempt + 1);
                } else {
                  res.write(`data: ${JSON.stringify({ error: errBody })}\n\n`);
                  res.write("data: [DONE]\n\n");
                  res.end();
                }
              });
              return;
            }

            let buffer = "";
            const utf8Decoder = new StringDecoder("utf8");
            proxyRes.on("data", (chunk) => {
              // Use StringDecoder so multi-byte UTF-8 chars (Chinese, em-dashes, emoji)
              // aren't corrupted when split across chunk boundaries
              buffer += utf8Decoder.write(chunk);
              // Process complete SSE messages
              const lines = buffer.split("\n");
              buffer = lines.pop(); // keep incomplete line
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const jsonStr = line.slice(6).trim();
                  if (!jsonStr) continue;
                  try {
                    const data = JSON.parse(jsonStr);
                    const parts = data.candidates?.[0]?.content?.parts || [];
                    for (const part of parts) {
                      if (part.text) {
                        res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
                      }
                    }
                    // Log token usage from final chunk
                    const usage = data.usageMetadata;
                    if (usage && usage.totalTokenCount) {
                      console.log(`[Tokens] prompt=${usage.promptTokenCount || 0} response=${usage.candidatesTokenCount || 0} thinking=${usage.thoughtsTokenCount || 0} total=${usage.totalTokenCount || 0}`);
                    }
                  } catch (e) {
                    // skip unparseable chunks
                  }
                }
              }
            });

            proxyRes.on("end", () => {
              // Flush any remaining bytes from the decoder
              const tail = utf8Decoder.end();
              if (tail) buffer += tail;
              res.write("data: [DONE]\n\n");
              res.end();
            });
          });

          proxyReq.setTimeout(180000, () => {
            proxyReq.destroy();
            if (attempt < 2) {
              console.log(`[Timeout] attempt ${attempt}, retrying...`);
              callStream(attempt + 1);
            } else {
              res.write(`data: ${JSON.stringify({ error: "Request timed out after retries" })}\n\n`);
              res.write("data: [DONE]\n\n");
              res.end();
            }
          });

          proxyReq.on("error", (e) => {
            if (attempt < 2) {
              console.log(`[Error] ${e.message}, retrying...`);
              callStream(attempt + 1);
            } else {
              res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
              res.write("data: [DONE]\n\n");
              res.end();
            }
          });

          proxyReq.write(postData);
          proxyReq.end();
        };

        callStream(1);

      } else {
        // === Non-streaming mode (fallback) ===
        const path = `/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;
        const callOnce = (attempt) => {
          const opts = {
            hostname: "generativelanguage.googleapis.com",
            path,
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": postData.length },
          };
          const proxyReq = https.request(opts, (proxyRes) => {
            // Accumulate raw bytes; decode once at end so multi-byte UTF-8 chars
            // (Chinese, em-dashes, emoji) aren't split across packet boundaries.
            const respChunks = [];
            proxyRes.on("data", (chunk) => respChunks.push(chunk));
            proxyRes.on("end", () => {
              const responseBody = Buffer.concat(respChunks).toString("utf8");
              if (proxyRes.statusCode >= 400) {
                console.error(`[Gemini ${proxyRes.statusCode}]`, responseBody.slice(0, 500));
                if (attempt < 2) { console.log(`[Retry] attempt ${attempt + 1}...`); callOnce(attempt + 1); }
                else { res.writeHead(proxyRes.statusCode, { "Content-Type": "application/json" }); res.end(responseBody); }
                return;
              }
              try {
                const geminiData = JSON.parse(responseBody);
                const text = geminiData.candidates?.[0]?.content?.parts?.map(p => p.text || "").filter(Boolean).join("\n") || "";
                const usage = geminiData.usageMetadata;
                if (usage) console.log(`[Tokens] prompt=${usage.promptTokenCount || 0} response=${usage.candidatesTokenCount || 0} thinking=${usage.thoughtsTokenCount || 0} total=${usage.totalTokenCount || 0}`);
                const result = { text };
                // Include grounding search results if available
                const grounding = geminiData.candidates?.[0]?.groundingMetadata;
                if (useSearch && grounding?.groundingChunks) console.log("[Grounding]", grounding.groundingChunks.length, "sources found");
                if (grounding?.groundingChunks) {
                  result.sources = grounding.groundingChunks
                    .filter(c => c.web)
                    .map(c => ({ title: c.web.title || "", uri: c.web.uri || "" }));
                }
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
              } catch (e) {
                console.error("[Gemini parse error]", e.message);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Failed to parse Gemini response" }));
              }
            });
          });
          proxyReq.setTimeout(180000, () => {
            proxyReq.destroy();
            if (attempt < 2) { console.log(`[Timeout] retrying...`); callOnce(attempt + 1); }
            else { res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Request timed out after retries" })); }
          });
          proxyReq.on("error", (e) => {
            if (attempt < 2) { console.log(`[Error] retrying...`); callOnce(attempt + 1); }
            else { if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: e.message })); }
          });
          proxyReq.write(postData);
          proxyReq.end();
        };
        callOnce(1);
      }
    });
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(3001, () => {
  console.log("\n🪶 Lyra API Proxy running on http://localhost:3001");
  console.log(`   Default model: ${DEFAULT_MODEL}`);
  console.log(`   Allowed models: ${[...ALLOWED_MODELS].join(", ")}`);
  console.log("   API key loaded: AIza......" + GEMINI_KEY.slice(-4));
  console.log(`   Rate limits: ${RATE_LIMIT.maxRequests}/min, ${RATE_LIMIT.dailyMax}/day\n`);
});
