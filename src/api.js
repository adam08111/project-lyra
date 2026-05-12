export async function callAI(systemPrompt, userMessage, useSearch = false, maxTokens = 1000, thinkingBudget, onChunk, signal, model) {
  const body = { system: systemPrompt, message: userMessage, maxTokens };
  if (thinkingBudget) body.thinkingBudget = thinkingBudget;
  if (useSearch) body.useSearch = true;
  if (model) body.model = model;

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
