// src/token-metrics.js — Step-0 diagnostic. Token COUNTS only, never content. Must never throw.
// ONE shared helper imported by BOTH proxies (server/proxy.js dev + api/gemini.js prod)
// so dev and prod can't drift on what they log (§3 single source of truth). Lives in
// src/ (NOT server/) so Vercel bundles it for api/gemini.js — server/ is .vercelignore'd.
export function logTokenUsage(usage, { model = "?", task = "?", stream = false } = {}) {
  try {
    if (!usage || typeof usage !== "object") return;
    if (process.env.TOKEN_DEBUG) console.info("[tokens:raw]", JSON.stringify(usage)); // Step 2: confirm field names
    const prompt   = usage.promptTokenCount        || 0;
    const cached   = usage.cachedContentTokenCount || 0;   // <- the number this whole step is for
    const thinking = usage.thoughtsTokenCount      || 0;   // confirmed: proxy.js already reads this name successfully
    const out      = usage.candidatesTokenCount    || 0;
    const total    = usage.totalTokenCount         || (prompt + out);
    const hitPct   = prompt ? Math.round((cached / prompt) * 100) : 0;
    console.info(
      `[tokens] model=${model} task=${task} stream=${stream ? 1 : 0} ` +
      `prompt=${prompt} cached=${cached} (${hitPct}% hit) think=${thinking} out=${out} total=${total}`
    );
  } catch (_) { /* never break a response (#7) */ }
}
