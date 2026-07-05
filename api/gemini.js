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
import { logTokenUsage } from "../src/token-metrics.js"; // Step-0 diagnostic (counts only)
import { SAFETY_SETTINGS, SAFETY_BLOCK_MESSAGE, isSafetyBlocked, BLOCKING_FINISH_REASONS } from "../src/safety-settings.js"; // F4 (§102)

export const config = { maxDuration: 60 }; // Hobby plan ceiling

const DEFAULT_MODEL = "gemini-flash-latest";
const ALLOWED_MODELS = new Set([
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-3-flash-preview",
]);
// Native TTS models (audio out) — SEPARATE allowlist from the text models (the tts
// branch builds a different request shape). Verified live: gemini-2.5-flash-tts 404s.
const DEFAULT_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_MODELS = new Set(["gemini-2.5-flash-preview-tts", "gemini-3.1-flash-tts-preview"]);
// The accent lever is this instruction (load-bearing); languageCode is belt-and-suspenders.
const ttsInstruction = (word, accent) => accent === "uk"
  ? `Say this single English word, and nothing else, clearly and naturally in a British Received Pronunciation accent: "${word}"`
  : `Say this single English word, and nothing else, clearly and naturally in a General American accent: "${word}"`;
const UPSTREAM_TIMEOUT_MS = 55000; // leave headroom under the 60s function cap

// ── F1 (§102): origin allow-listing. The Basic-Auth gate (middleware.js) stays the
// primary control; this is defense-in-depth so a cross-origin page can't invoke the
// Gemini-billed endpoint from a gated user's browser. Allowed origin = ALLOWED_ORIGIN
// env when set, else the deployment's own origin (derived from the request Host). A
// request with NO Origin header (same-origin fetch / server-to-server) is allowed —
// browsers always send Origin on a cross-origin POST, so its absence is never the attack.
function allowedOrigin(req) {
  if (process.env.ALLOWED_ORIGIN) return process.env.ALLOWED_ORIGIN;
  const host = req.headers.host;
  if (!host) return null;
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  return `${proto}://${host}`;
}
function isOriginAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;                // same-origin / non-browser (still gated by Basic-Auth)
  const allowed = allowedOrigin(req);
  return !allowed || origin === allowed;   // can't resolve host → fail open (never break the app)
}

// ── F2 (§102): best-effort per-identity rate limit. In-memory ONLY, so it lives per
// WARM serverless instance and does NOT persist across cold starts or scale-out — a
// FLOOR against one runaway client exhausting the shared Gemini quota, not a durable
// fortress (a Supabase-/KV-backed limiter is the noted follow-up, out of scope here).
// Keyed by the Supabase student_id the client forwards, else the request IP.
const RL_WINDOW_MS = 60 * 1000;
const RL_MAX_PER_MIN = 40; // conservative ceiling; a normal coaching session stays well under
const rlHits = new Map(); // key -> number[] (recent request timestamps)
function clientKey(req, parsed) {
  const sid = parsed && typeof parsed.studentId === "string" && parsed.studentId.trim();
  if (sid) return `sid:${sid}`;
  const xff = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return `ip:${xff || req.socket?.remoteAddress || "unknown"}`;
}
function rateLimited(key) {
  const now = Date.now();
  const recent = (rlHits.get(key) || []).filter((t) => t > now - RL_WINDOW_MS);
  if (recent.length >= RL_MAX_PER_MIN) { rlHits.set(key, recent); return true; }
  recent.push(now);
  rlHits.set(key, recent);
  if (rlHits.size > 5000) { // bound memory on a long-lived warm instance
    for (const [k, v] of rlHits) if (!v.some((t) => t > now - RL_WINDOW_MS)) rlHits.delete(k);
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    // F1: echo the requesting origin only when it matches the allow-listed origin;
    // otherwise advertise the configured origin so a foreign origin fails the preflight.
    const allowed = allowedOrigin(req);
    const origin = req.headers.origin;
    res.setHeader("Access-Control-Allow-Origin", (origin && allowed && origin === allowed) ? origin : (allowed || ""));
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  // F1 (§102): reject cross-origin POSTs (defense-in-depth alongside the Basic-Auth gate).
  if (!isOriginAllowed(req)) {
    res.status(403).json({ error: "Cross-origin request rejected" });
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

  // F2 (§102): best-effort rate limit BEFORE any billed upstream call (covers the text,
  // vision and TTS paths). Headers aren't sent yet, so a clean 429 is safe everywhere.
  if (rateLimited(clientKey(req, parsed))) {
    res.status(429).json({ error: "Too many requests — please slow down and try again in a minute." });
    return;
  }

  // ── Error-body policy — two categories, keep them distinct (see §94.3) ──
  // A) Upstream Gemini returned HTTP 4xx/5xx WITH a body: the TEXT paths pass it
  //    RAW (non-stream: + upstream status; stream: inside the SSE data:{error} line)
  //    so the client sees Gemini's real error. TTS is the deliberate exception — it
  //    WRAPS+TRUNCATES so a student never sees a raw Google blob.
  // B) Proxy-OWN failure (timeout / socket, no upstream response): every path
  //    SYNTHESIZES a wrapped {error: msg}. Don't flatten A into B (or the text paths'
  //    raw passthrough into the TTS wrap) in a future "consistency" pass.
  // === TTS branch: native Gemini speech synthesis (audio out) ===
  // Separate request shape (responseModalities:AUDIO + speechConfig), non-streaming
  // generateContent. Returns raw PCM (base64, s16le, 24kHz mono) + its sample rate.
  if (parsed.tts && typeof parsed.tts.text === "string") {
    const word = String(parsed.tts.text).slice(0, 100); // single word — clamp, don't trust the client
    const accent = parsed.tts.accent === "uk" ? "uk" : "us";
    const ttsModel = parsed.model && TTS_MODELS.has(parsed.model) ? parsed.model : DEFAULT_TTS_MODEL;
    const lang = accent === "uk" ? "en-GB" : "en-US";
    const ttsBody = Buffer.from(JSON.stringify({
      contents: [{ parts: [{ text: ttsInstruction(word, accent) }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { languageCode: lang, voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      },
    }));
    const opts = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${ttsModel}:generateContent?key=${GEMINI_KEY}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": ttsBody.length },
    };
    // One-shot guard, same as the text paths (the dev proxy's TTS branch already has it):
    // destroy() on timeout also fires 'error', so guard every terminal path with settled —
    // exactly one wins. headersSent stays as belt-and-suspenders. Single attempt (no retry).
    let settled = false;
    const proxyReq = https.request(opts, (proxyRes) => {
      const chunks = [];
      proxyRes.on("data", (c) => chunks.push(c));
      proxyRes.on("end", () => {
        if (settled) return; settled = true;
        const respBody = Buffer.concat(chunks).toString("utf8");
        if (proxyRes.statusCode >= 400) {
          // Category A → wrap + truncate the upstream error (parity with server/proxy.js) —
          // don't echo a raw Google error blob to a student. (The TEXT paths pass raw.)
          if (!res.headersSent) res.status(proxyRes.statusCode).json({ error: respBody.slice(0, 500) });
          return;
        }
        try {
          const data = JSON.parse(respBody);
          logTokenUsage(data.usageMetadata, { model: ttsModel, task: "tts", stream: false });
          const part = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData && p.inlineData.data);
          const audioBase64 = part?.inlineData?.data || "";
          const rate = /rate=(\d+)/i.exec(part?.inlineData?.mimeType || "");
          if (!audioBase64) { res.status(502).json({ error: "TTS returned no audio" }); return; }
          res.status(200).json({ audioBase64, sampleRate: rate ? parseInt(rate[1], 10) : 24000 });
        } catch (e) {
          res.status(500).json({ error: "Failed to parse TTS response" });
        }
      });
    });
    // Category B → synthesized {error} (no upstream response to pass through)
    proxyReq.setTimeout(UPSTREAM_TIMEOUT_MS, () => { proxyReq.destroy(); if (settled) return; settled = true; if (!res.headersSent) res.status(504).json({ error: "TTS timed out" }); });
    proxyReq.on("error", (e) => { if (settled) return; settled = true; if (!res.headersSent) res.status(500).json({ error: e.message }); });
    proxyReq.write(ttsBody);
    proxyReq.end();
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
    safetySettings: SAFETY_SETTINGS, // F4 (§102): gates text AND the vision/OCR path (shared body)
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
    // One-shot guard: proxyReq.destroy() on timeout ALSO fires 'error', so without this both the
    // timeout and error handlers would write [DONE]+end to the same res (racing terminal writes).
    // settled lets exactly one path win. Single attempt here (no retry — 60s function cap).
    let settled = false;
    const endStream = (errMsg) => {
      if (errMsg != null) res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    };
    const opts = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": postData.length },
    };
    const proxyReq = https.request(opts, (proxyRes) => {
      if (proxyRes.statusCode >= 400) {
        // Category A → forward the raw upstream body inside the SSE data:{error} line
        const errChunks = [];
        proxyRes.on("data", (c) => errChunks.push(c));
        proxyRes.on("end", () => {
          if (settled) return; settled = true;
          const errBody = Buffer.concat(errChunks).toString("utf8");
          endStream(errBody);
        });
        return;
      }
      let buffer = "";
      let lastUsage = null; // Step-0: usageMetadata rides the FINAL SSE chunk; capture, log once after the loop
      let wroteText = false; // F4 (§102): did any content reach the client?
      let blocked = false;   // F4 (§102): safety block seen (finishReason SAFETY / promptFeedback)
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
              if (part.text) { res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`); wroteText = true; }
            }
            if (BLOCKING_FINISH_REASONS.has(data.candidates?.[0]?.finishReason) || data.promptFeedback?.blockReason) blocked = true;
            if (data.usageMetadata) lastUsage = data.usageMetadata; // Step-0: capture for one post-loop log
          } catch (e) { /* skip unparseable chunk */ }
        }
      });
      proxyRes.on("end", () => {
        if (settled) return; settled = true;
        const tail = utf8Decoder.end();
        if (tail) buffer += tail;
        logTokenUsage(lastUsage, { model: MODEL, stream: true });
        // F4 (#7): a safety block yields no text — surface an honest, retryable line, never a blank.
        if (!wroteText && blocked) res.write(`data: ${JSON.stringify({ text: SAFETY_BLOCK_MESSAGE })}\n\n`);
        endStream(null);
      });
    });
    // Category B → synthesized {error} in the SSE line (no upstream response)
    proxyReq.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
      proxyReq.destroy();
      if (settled) return; settled = true;
      endStream("Request timed out");
    });
    proxyReq.on("error", (e) => {
      if (settled) return; settled = true;
      endStream(e.message);
    });
    proxyReq.write(postData);
    proxyReq.end();
    return;
  }

  // === Non-streaming (buffered JSON) ===
  // One-shot guard for parity with the streaming path: destroy() on timeout also fires 'error',
  // so guard every terminal path with settled — exactly one wins. Single attempt (60s cap).
  let settled = false;
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
      if (settled) return; settled = true;
      const responseBody = Buffer.concat(respChunks).toString("utf8"); // decode once → no split UTF-8
      if (proxyRes.statusCode >= 400) {
        // Category A → forward the raw upstream body + upstream status, unwrapped
        res.status(proxyRes.statusCode).setHeader("Content-Type", "application/json");
        res.end(responseBody);
        return;
      }
      try {
        const geminiData = JSON.parse(responseBody);
        logTokenUsage(geminiData.usageMetadata, { model: MODEL, stream: false });
        const text = geminiData.candidates?.[0]?.content?.parts?.map((p) => p.text || "").filter(Boolean).join("\n") || "";
        // F4 (#7): a safety block yields no text — return an honest, retryable message, not a blank.
        if (!text && isSafetyBlocked(geminiData)) { res.status(200).json({ text: SAFETY_BLOCK_MESSAGE }); return; }
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
  // Category B → synthesized {error} (no upstream response to pass through)
  proxyReq.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
    proxyReq.destroy();
    if (settled) return; settled = true;
    if (!res.headersSent) res.status(504).json({ error: "Request timed out" });
  });
  proxyReq.on("error", (e) => {
    if (settled) return; settled = true;
    if (!res.headersSent) res.status(500).json({ error: e.message });
  });
  proxyReq.write(postData);
  proxyReq.end();
}
