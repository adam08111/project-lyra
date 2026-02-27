// Simple proxy to forward requests to Anthropic API (avoids CORS from localhost)
// Usage: node server/proxy.js

import http from "http";
import https from "https";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load API key from .env file
let API_KEY = process.env.ANTHROPIC_API_KEY || "";
const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  const match = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
  if (match) API_KEY = match[1].trim();
}

if (!API_KEY) {
  console.error("\n❌ No ANTHROPIC_API_KEY found!");
  console.error("   Create a .env file with: ANTHROPIC_API_KEY=sk-ant-...\n");
  process.exit(1);
}

// === Rate Limiting ===
const RATE_LIMIT = {
  windowMs: 60 * 1000,    // 1 minute window
  maxRequests: 30,         // max 30 requests per minute
  dailyMax: 500,           // max 500 requests per day
};

const requestLog = [];
let dailyCount = 0;
let dailyResetTime = Date.now() + 24 * 60 * 60 * 1000;

function isRateLimited() {
  const now = Date.now();

  // Reset daily counter
  if (now > dailyResetTime) {
    dailyCount = 0;
    dailyResetTime = now + 24 * 60 * 60 * 1000;
  }

  // Check daily limit
  if (dailyCount >= RATE_LIMIT.dailyMax) {
    return { limited: true, reason: `Daily limit reached (${RATE_LIMIT.dailyMax} requests). Resets in ${Math.ceil((dailyResetTime - now) / 3600000)}h.` };
  }

  // Clean old entries from sliding window
  const windowStart = now - RATE_LIMIT.windowMs;
  while (requestLog.length > 0 && requestLog[0] < windowStart) {
    requestLog.shift();
  }

  // Check per-minute limit
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
  // CORS headers
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

  if (req.method === "POST" && req.url === "/api/anthropic") {
    // Check rate limit before processing
    const rateCheck = isRateLimited();
    if (rateCheck.limited) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: rateCheck.reason }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      recordRequest();
      const postData = Buffer.from(body);
      try {
        const parsed = JSON.parse(body);
        console.log(`[Request] model=${parsed.model} max_tokens=${parsed.max_tokens} system_len=${(parsed.system||"").length} msg_len=${JSON.stringify(parsed.messages).length} tools=${parsed.tools ? "yes" : "no"}`);
      } catch(e) { console.log("[Request] body parse failed"); }
      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Length": postData.length,
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        if (proxyRes.statusCode >= 400) {
          let errorBody = "";
          proxyRes.on("data", chunk => errorBody += chunk);
          proxyRes.on("end", () => {
            console.error(`[Anthropic ${proxyRes.statusCode}]`, errorBody.slice(0, 500));
            res.writeHead(proxyRes.statusCode, { "Content-Type": "application/json" });
            res.end(errorBody);
          });
          return;
        }
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.setTimeout(120000, () => {
        proxyReq.destroy(new Error("Request to Anthropic API timed out after 120s"));
      });

      proxyReq.on("error", (e) => {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
        }
        res.end(JSON.stringify({ error: e.message }));
      });

      proxyReq.write(postData);
      proxyReq.end();
    });
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(3001, () => {
  console.log("\n🪶 Lyra API Proxy running on http://localhost:3001");
  console.log("   Forwarding to api.anthropic.com");
  console.log("   API key loaded: sk-ant-......" + API_KEY.slice(-4));
  console.log(`   Rate limits: ${RATE_LIMIT.maxRequests}/min, ${RATE_LIMIT.dailyMax}/day\n`);
});
