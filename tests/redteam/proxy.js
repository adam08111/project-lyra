// §103 red-team — proxy client. Calls the SAME proxy the app uses (default the local
// dev proxy on :3001), so every harness call runs through the real model/brain/safety
// config — including §102's live SAFETY_SETTINGS. The key never touches the harness: the
// proxy reads it from .env, exactly like the app. Non-streaming, serial, 429-aware.

const PROXY_URL = process.env.REDTEAM_PROXY_URL || "http://127.0.0.1:3001/api/gemini";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * POST one non-streaming request to the proxy and return the model's text.
 * Retries a 429 (the dev proxy's 30/min limiter) with backoff. Throws on hard failure.
 * @returns {Promise<{ text: string, ok: boolean, status: number, error?: string }>}
 */
export async function proxyCall({ system = "", message = "", model, thinkingBudget, maxTokens = 1200, image, studentId } = {}, { retries = 3 } = {}) {
  const body = { system, message, stream: false, maxTokens };
  if (model) body.model = model;
  if (thinkingBudget != null) body.thinkingBudget = thinkingBudget;
  if (image && image.data) body.image = image;
  if (studentId) body.studentId = studentId;

  let lastErr = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 429) {
        const wait = 3000 * (attempt + 1);
        lastErr = "429 rate-limited";
        await sleep(wait);
        continue;
      }
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = { text: raw }; }
      if (!res.ok) return { text: "", ok: false, status: res.status, error: (data && data.error) || raw.slice(0, 200) };
      return { text: (data && data.text) || "", ok: true, status: res.status };
    } catch (e) {
      lastErr = e && e.message ? e.message : String(e);
      await sleep(1500 * (attempt + 1));
    }
  }
  return { text: "", ok: false, status: 0, error: lastErr || "request failed" };
}

export { PROXY_URL };
