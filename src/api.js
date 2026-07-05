import { STUDENT_ID_HINT } from "./supabase-client.js";

// F2 (§102): forward the already-known Supabase student id so the proxy can rate-limit
// per identity (it falls back to IP when this is absent / the sync flag is off). Read-only,
// best-effort, never throws — the id is used only as a rate-limit key, never sent upstream.
function currentStudentId() {
  try {
    return (typeof localStorage !== "undefined" && localStorage.getItem(STUDENT_ID_HINT)) || null;
  } catch {
    return null;
  }
}

// Photo OCR via Gemini vision. Sends a base64 image + an extraction prompt to the
// same /api/gemini proxy (which builds an inline_data part), and returns the
// extracted text. Replaces the old direct Claude call — the app is now Gemini-only.
export async function extractTextFromImage({ base64, mediaType, prompt, model, maxTokens = 2000 }) {
  const sid = currentStudentId();
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: "",
      message: prompt,
      image: { data: base64, mediaType: mediaType || "image/jpeg" },
      maxTokens,
      stream: false,
      ...(sid ? { studentId: sid } : {}),
      ...(model ? { model } : {}),
    }),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`OCR request failed (${res.status}): ${errorText}`);
  }
  const data = await res.json();
  return data.text || "";
}

// Word-lookup pronunciation via native Gemini TTS. Goes through the SAME /api/gemini
// proxy (key stays server-side, exactly like extractTextFromImage) — the proxy's tts
// branch builds the AUDIO generateContent request and returns raw PCM. Returns the
// base64 PCM (s16le) + its sample rate; the caller wraps it in a WAV container to play.
export async function synthesizeSpeech({ word, accent, model }) {
  // Client-side hard timeout: if the proxy stalls (black-holes with no response), a
  // signal-less fetch never settles and the caller's spinner sticks forever (#7). Abort
  // just above the proxy's own 60s upstream cap so a stall surfaces as an error → the
  // caller falls back to the recording / browser TTS instead of an eternal ⏳.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 65000);
  const sid = currentStudentId();
  try {
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tts: { text: word, accent },
        stream: false,
        ...(sid ? { studentId: sid } : {}),
        ...(model ? { model } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      throw new Error(`TTS request failed (${res.status}): ${errorText}`);
    }
    const data = await res.json();
    if (!data.audioBase64) throw new Error("TTS returned no audio");
    return { audioBase64: data.audioBase64, sampleRate: data.sampleRate || 24000 };
  } finally {
    clearTimeout(timer);
  }
}

export async function callAI(systemPrompt, userMessage, useSearch = false, maxTokens = 1000, thinkingBudget, onChunk, signal, model) {
  const body = { system: systemPrompt, message: userMessage, maxTokens };
  if (thinkingBudget) body.thinkingBudget = thinkingBudget;
  if (useSearch) body.useSearch = true;
  if (model) body.model = model;
  const sid = currentStudentId();
  if (sid) body.studentId = sid;

  // Use streaming when onChunk callback is provided, otherwise non-streaming
  if (!onChunk) body.stream = false;

  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`API request failed (${res.status}): ${errorText}`);
  }

  // Non-streaming: return full text (and sources if search grounding was used)
  if (!onChunk) {
    const data = await res.json();
    if (data.sources) return { text: data.text || "", sources: data.sources };
    return data.text || "";
  }

  // Streaming: read SSE events and accumulate text
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;
        try {
          const data = JSON.parse(payload);
          if (data.error) throw new Error(data.error);
          if (data.text) {
            fullText += data.text;
            onChunk(fullText);
          }
        } catch (e) {
          if (e.message && !e.message.includes("JSON")) throw e;
        }
      }
    }
  }

  return fullText;
}
