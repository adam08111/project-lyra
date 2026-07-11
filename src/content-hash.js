/**
 * CONTENT-HASH — the shared cheap/stable content hash for the append-only snapshot emitters
 * (BRIEF-RS single-source-of-truth, CLAUDE.md #3). Extracted from writing-snapshots.js (§112)
 * so the writing-snapshot and report-snapshot emitters share ONE hash instead of diverging
 * copies. FNV-1a + length: a collision only MISSES a dedup (self-healed by the next change),
 * never corrupts. NOT a crypto hash — dedup only, never a security boundary.
 *
 * NOTE: blob-mirror.js (§101) still carries its own identical copy of this hash; converging it
 * is a separate, out-of-scope cleanup (it is §101 working code, untouched by BRIEF-RS).
 */

/** FNV-1a(string) + ":" + length — stable content-key hash for dedup. */
export function hashContent(v) {
  const s = v == null ? "" : String(v);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) + ":" + s.length;
}

/** UTF-8 byte length (for the size sanity rails); falls back to char length if TextEncoder is absent. */
export function byteLen(s) {
  try { return new TextEncoder().encode(s == null ? "" : String(s)).length; }
  catch (e) { return (s == null ? 0 : String(s).length); }
}
