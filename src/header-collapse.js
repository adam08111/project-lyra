/**
 * Pure collapse decision for the chat header (§41).
 *
 * Driven by the chat scroll container's scrollTop. HYSTERESIS prevents the
 * header flickering when the user hovers around a single threshold: it
 * collapses only once scrolled past 24px, and expands again only when back
 * within 8px of the top. Inside the [8, 24] band the current state is kept.
 */
export function nextHeaderCollapsed(scrollTop, current) {
  if (scrollTop > 24) return true;   // scrolled into the conversation → collapse
  if (scrollTop < 8) return false;   // back at the top → expand
  return !!current;                  // hysteresis band — hold steady
}
