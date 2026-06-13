/**
 * ZH REGISTER — deterministic display-time conversion of spoken Cantonese
 * tokens to standard written Chinese (書面語).
 *
 * The coaching prompts already DEMAND 書面語 (LYRA_BRAIN "CHINESE REGISTER",
 * REPORT_CARD_BRAIN, the annotation/word-lookup prompts). This is the belt to
 * those braces: it heals Chinese ALREADY SAVED in spoken Cantonese — Masterclass
 * reports / Achievement cards are never regenerated, so a prompt change can't
 * touch them — and catches any spoken token a model still slips through.
 *
 * Pure and render-only (no data mutation). Almost every token below is
 * Cantonese-EXCLUSIVE (never appears in standard written Chinese), so a blanket
 * swap is safe. The two that DO collide with written words — 係 (關係/聯係) and
 * the false bigram 入面 (進入 + 面試…) — are protected with a mask/restore pass.
 */

// Verbs that take 入, so "…入面" is a false bigram (進入 + 面試), not Cantonese
// "inside". Their 入 is masked before the 入面 -> 裡面 swap, then restored.
const RU_VERBS = "進深出加收投融介陷捲列納植侵匯輸錄嵌帶代載切購引插混潛闖擠塞湧";

// Ordered: multi-char tokens first so they win over single-char swaps.
const PAIRS = [
  [/我哋/g, "我們"], [/你哋/g, "你們"], [/佢哋/g, "他們"],
  [/乜嘢/g, "什麼"], [/同埋/g, "和"], [/而家/g, "現在"], [/入面/g, "裡面"],
  [/嘅/g, "的"], [/唔/g, "不"], [/喺/g, "在"], [/嚟/g, "來"],
  [/嗰/g, "那"], [/啲/g, "些"], [/畀/g, "給"], [/冇/g, "沒有"],
  [/噉/g, "這樣"], [/咁/g, "這麼"], [/嘢/g, "東西"], [/哋/g, "們"],
  [/乜/g, "什麼"], [/佢/g, "他"], [/係/g, "是"],
];

// Private-use-area sentinels — cannot occur in real coaching text, so masking
// with them never collides with English letters or CJK content.
const MASK_RU = String.fromCharCode(0xE000);
const MASK_GX = String.fromCharCode(0xE001);
const MASK_LX = String.fromCharCode(0xE002);

/**
 * Convert spoken Cantonese in a string to standard written Chinese. Returns the
 * input unchanged when it carries none. Safe on mixed English/Chinese text
 * (the tokens are CJK; English is untouched).
 */
export function toWrittenChinese(text) {
  if (!text || typeof text !== "string") return text;
  let out = text;
  // Protect written words the naive single-char swaps would corrupt.
  out = out.replace(new RegExp("([" + RU_VERBS + "])入", "g"), "$1" + MASK_RU); // 進入 -> 進<mask>
  out = out.replace(/關係/g, MASK_GX).replace(/聯係/g, MASK_LX);
  for (const [re, rep] of PAIRS) out = out.replace(re, rep);
  // Restore the protected words.
  out = out.replace(new RegExp(MASK_RU, "g"), "入")
           .replace(new RegExp(MASK_GX, "g"), "關係")
           .replace(new RegExp(MASK_LX, "g"), "聯係");
  return out;
}
