// Vercel Serverless Function — Lyra's Gemini proxy on the SAME ORIGIN as the
// static app, so the client's relative `fetch("/api/gemini")` Just Works in
// production. This is the deploy-time twin of server/proxy.js (used in local
// dev). It hides GEMINI_API_KEY (read from the Vercel env var, NEVER committed)
// and forwards to Google, supporting BOTH the SSE streaming mode (when the
// client passes an onChunk) and the buffered JSON mode (default).
//
// Differences from server/proxy.js, all forced by the serverless model:
//  - Key comes ONLY from process.env (no .env file on the host).
//  - SINGLE upstream attempt with a ~55s timeout: Vercel's Hobby function cap is
//    60s, so the proxy.js 3×180s retry budget cannot fit. (If you need long
//    thinking-heavy calls to never time out, run server/proxy.js on a always-on
//    Node host instead — see DEPLOY.md.)
//  - No in-memory rate limiting: each invocation is isolated, so a per-process
//    counter does nothing. Abuse is controlled by the Basic-Auth gate
//    (middleware.js) + your Gemini quota.

import https from "https";
import { StringDecoder } from "string_decoder";

export const config = { maxDuration: 60 }; // Hobby plan ceiling

const DEFAULT_MODEL = "gemini-flash-latest";
const ALLOWED_MODELS = new Set([
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
]);
const UPSTREAM_TIMEOUT_MS = 55000; // leave headroom under the 60s function cap

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
  if (!GEMINI_KEY) {
    res.status(500).json({ error: "Server missing GEMINI_API_KEY env var" });
    return;
  }

  // Vercel parses a JSON body into req.body; tolerate a raw string AND a runtime
  // that doesn't pre-parse (read the stream once, decode as UTF-8 so Chinese
  // prompts survive).
  let parsed = req.body;
  if (parsed === undefined || parsed === null || parsed === "") {
    const raw = await new Promise((resolve) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", () => resolve(""));
    });
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
  } else if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch (e) { parsed = null; }
  }
  if (!parsed || typeof parsed !== "object") {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const { system, message, maxTokens = 1000, thinkingBudget, useSearch, image } = parsed;
  const MODEL = parsed.model && ALLOWED_MODELS.has(parsed.model) ? parsed.model : DEFAULT_MODEL;

  const genConfig = { maxOutputTokens: maxTokens };
  if (thinkingBudget && !useSearch) genConfig.thinkingConfig = { thinkingBudget };
  // Optional image (photo OCR): a Gemini vision inline_data part before the text.
  const userParts = [];
  if (image && image.data) userParts.push({ inline_data: { mime_type: image.mediaType || "image/jpeg", data: image.data } });
  userParts.push({ text: message || "" });
  const geminiReq = {
    system_instruction: { parts: [{ text: system || "" }] },
    contents: [{ role: "user", parts: userParts }],
    generationConfig: genConfig,
  };
  if (useSearch) geminiReq.tools = [{ google_search: {} }];
  const postData = Buffer.from(JSON.stringify(geminiReq));

  const useStream = parsed.stream !== false;

  if (useStream) {
    // === Streaming (SSE) ===
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const opts = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": postData.length },
    };
    const proxyReq = https.request(opts, (proxyRes) => {
      if (proxyRes.statusCode >= 400) {
        const errChunks = [];
        proxyRes.on("data", (c) => errChunks.push(c));
        proxyRes.on("end", () => {
          const errBody = Buffer.concat(errChunks).toString("utf8");
          res.write(`data: ${JSON.stringify({ error: errBody })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        });
        return;
      }
      let buffer = "";
      const utf8Decoder = new StringDecoder("utf8");
      proxyRes.on("data", (chunk) => {
        buffer += utf8Decoder.write(chunk); // never split a multi-byte UTF-8 char
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const data = JSON.parse(jsonStr);
            const parts = data.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.text) res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
            }
          } catch (e) { /* skip unparseable chunk */ }
        }
      });
      proxyRes.on("end", () => {
        const tail = utf8Decoder.end();
        if (tail) buffer += tail;
        res.write("data: [DONE]\n\n");
        res.end();
      });
    });
    proxyReq.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
      proxyReq.destroy();
      res.write(`data: ${JSON.stringify({ error: "Request timed out" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });
    proxyReq.on("error", (e) => {
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });
    proxyReq.write(postData);
    proxyReq.end();
    return;
  }

  // === Non-streaming (buffered JSON) ===
  const opts = {
    hostname: "generativelanguage.googleapis.com",
    path: `/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": postData.length },
  };
  const proxyReq = https.request(opts, (proxyRes) => {
    const respChunks = [];
    proxyRes.on("data", (chunk) => respChunks.push(chunk));
    proxyRes.on("end", () => {
      const responseBody = Buffer.concat(respChunks).toString("utf8"); // decode once → no split UTF-8
      if (proxyRes.statusCode >= 400) {
        res.status(proxyRes.statusCode).setHeader("Content-Type", "application/json");
        res.end(responseBody);
        return;
      }
      try {
        const geminiData = JSON.parse(responseBody);
        const text = geminiData.candidates?.[0]?.content?.parts?.map((p) => p.text || "").filter(Boolean).join("\n") || "";
        const result = { text };
        const grounding = geminiData.candidates?.[0]?.groundingMetadata;
        if (grounding?.groundingChunks) {
          result.sources = grounding.groundingChunks
            .filter((c) => c.web)
            .map((c) => ({ title: c.web.title || "", uri: c.web.uri || "" }));
        }
        res.status(200).json(result);
      } catch (e) {
        res.status(500).json({ error: "Failed to parse Gemini response" });
      }
    });
  });
  proxyReq.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
    proxyReq.destroy();
    if (!res.headersSent) res.status(504).json({ error: "Request timed out" });
  });
  proxyReq.on("error", (e) => {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  });
  proxyReq.write(postData);
  proxyReq.end();
}
