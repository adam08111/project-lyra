export async function callAI(systemPrompt, userMessage, useSearch = false, maxTokens = 1000) {
  const tools = useSearch ? [{ type: "web_search_20250305", name: "web_search" }] : undefined;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      ...(tools && { tools }),
    }),
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`API request failed (${res.status}): ${errorText}`);
  }
  const data = await res.json();
  return data.content?.map(b => b.text || "").filter(Boolean).join("\n") || "";
}
