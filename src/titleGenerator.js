import { writingTypes } from "./constants.js";

/**
 * Generate a short, readable title from the user's topic and writing type.
 * Extracts the core subject (first meaningful phrase) and prepends the type.
 * e.g. "Complaint Letter — Neighbour's Dog Bit Me"
 *
 * @param {string} topic - The user's raw topic description
 * @param {string} typeId - Writing type id (e.g. "complaint", "essay")
 * @returns {string} A brief, human-readable title
 */
/**
 * Extract the core subject of a raw topic: strip "e.g." prefixes, instruction
 * verbs ("Write …", "I want to write …") and leading articles, keep the first
 * clause, capitalize, truncate. Shared by generateTitle and the canned chat
 * welcome (which used to echo the raw instruction verbatim — "a formal
 * business email about 'write a letter to editor…'").
 * @returns {string} the brief, or "" when nothing meaningful survives
 */
export function topicBrief(topic, maxLen = 50) {
  let cleaned = (topic || "")
    .replace(/^e\.g\.?\s*/i, "")
    .replace(/\n+/g, " ")
    .trim();
  if (!cleaned) return "";

  // First sentence or clause (up to first period, ellipsis, or dash)
  let brief = cleaned.split(/[.…—\n]/)[0].trim();

  // Remove leading filler — run twice to catch chained fillers
  // (e.g. "I need a formal..." → strip "I need " → strip "a ")
  brief = brief
    .replace(/^(I want to write |I need to write |I want |I need |Write |A formal |An? )/i, "")
    .replace(/^(An? )/i, "")
    .trim();

  if (!brief || /^(a|an)$/i.test(brief)) return "";

  brief = brief[0].toUpperCase() + brief.slice(1);
  if (brief.length > maxLen) {
    brief = brief.slice(0, maxLen - 3).replace(/\s+\S*$/, "") + "...";
  }
  return brief;
}

export function generateTitle(topic, typeId) {
  const typeLabel = writingTypes.find(w => w.id === typeId)?.label || "";
  const brief = topicBrief(topic, 50);
  if (!brief) return typeLabel || "Untitled";
  // Combine: "Complaint Letter — Dog Bit Me"
  if (typeLabel) return `${typeLabel} — ${brief}`;
  return brief;
}
