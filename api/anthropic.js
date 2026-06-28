// Vercel Serverless Function — the Claude (Anthropic) proxy for Lyra's PHOTO OCR.
// The text AI runs on Gemini (api/gemini.js); the camera/gallery "read this photo"
// features (SourceSetup source text, SourceSetup exam question, Onboarding task)
// use Claude vision (claude-sonnet-4-6). The client never calls Anthropic directly:
// src/api-patch.js patches window.fetch so any "api.anthropic.com/v1/messages" call
// is rewritten to this same-origin "/api/anthropic" with its auth headers stripped.
// This function adds the key from the server env and forwards to Anthropic.
//
// Set ANTHROPIC_API_KEY in the Vercel dashboard (never committed). Without it,
// photo OCR returns 500 and the app shows its "couldn't read that photo" message
// (text paste still works on Gemini).

import https from "https";

export const config = { maxDuration: 60 };

const ANTHROPIC_VERSION = "2023-06-01";

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

  const KEY = process.env.ANTHROPIC_API_KEY || "";
  if (!KEY) {
    res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY env var" });
    return;
  }

  // The body is the Anthropic /v1/messages payload (model + messages, incl. a
  // base64 image). Forward it verbatim. Handle a pre-parsed object, a raw string,
  // or an unparsed stream — and read raw bytes so the base64 image is intact.
  let bodyStr;
  if (typeof req.body === "string") {
    bodyStr = req.body;
  } else if (req.body && typeof req.body === "object" && Object.keys(req.body).length) {
    bodyStr = JSON.stringify(req.body);
  } else {
    bodyStr = await new Promise((resolve) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", () => resolve(""));
    });
  }
  if (!bodyStr) {
    res.status(400).json({ error: "Empty request body" });
    return;
  }
  const postData = Buffer.from(bodyStr, "utf8");

  const opts = {
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": postData.length,
      "x-api-key": KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
  };

  const upstream = https.request(opts, (up) => {
    const chunks = [];
    up.on("data", (c) => chunks.push(c));
    up.on("end", () => {
      // Forward Anthropic's JSON body verbatim (the client reads `data.content`).
      // Buffer.concat → one UTF-8 decode so multi-byte OCR text isn't corrupted.
      const buf = Buffer.concat(chunks);
      if (!res.headersSent) {
        res.status(up.statusCode || 200);
        res.setHeader("Content-Type", "application/json");
      }
      res.end(buf);
    });
  });
  upstream.setTimeout(55000, () => {
    upstream.destroy();
    if (!res.headersSent) res.status(504).json({ error: "Request timed out" });
  });
  upstream.on("error", (e) => {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  });
  upstream.write(postData);
  upstream.end();
}
