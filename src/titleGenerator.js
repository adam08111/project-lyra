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
export function generateTitle(topic, typeId) {
  const typeLabel = writingTypes.find(w => w.id === typeId)?.label || "";

  // Clean up the topic — remove "e.g." prefixes, leading articles for brevity
  let cleaned = topic
    .replace(/^e\.g\.?\s*/i, "")
    .replace(/\n+/g, " ")
    .trim();

  if (!cleaned) return typeLabel || "Untitled";

  // Take the first sentence or clause (up to first period, ellipsis, or dash)
  let brief = cleaned.split(/[.…—\n]/)[0].trim();

  // Remove leading filler like "A ", "An ", "I want ", "My ", "A formal ", etc.
  // Run twice to catch chained fillers (e.g. "I need a formal..." → strip "I need " → strip "a ")
  brief = brief
    .replace(/^(I want to write |I need to write |I want |I need |Write |A formal |An? )/i, "")
    .replace(/^(An? )/i, "")
    .trim();

  // If stripping left only a bare article or nothing, fall back
  if (!brief || /^(a|an)$/i.test(brief)) {
    return typeLabel || "Untitled";
  }

  // Capitalize first letter
  if (brief.length > 0) {
    brief = brief[0].toUpperCase() + brief.slice(1);
  }

  // Truncate to a sensible length (max ~50 chars)
  if (brief.length > 50) {
    brief = brief.slice(0, 47).replace(/\s+\S*$/, "") + "...";
  }

  if (!brief) return typeLabel || "Untitled";

  // Combine: "Complaint Letter — Dog Bit Me"
  if (typeLabel) return `${typeLabel} — ${brief}`;
  return brief;
}
