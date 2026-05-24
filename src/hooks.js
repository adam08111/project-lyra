// useTypewriter — kept as a hook for API compatibility with existing
// bubble components (TypewriterBubble, PracticeTypingBubble, ChatTab
// welcome banner), but the gradual character-by-character reveal has
// been removed. The animation read as sluggish on long LYRA_BRAIN
// coaching turns (multi-paragraph responses) and was inconsistent
// with the TrainingSession chat, which renders messages instantly.
// Now: the full text is returned synchronously and `done` is true
// immediately, so the components fire their onDone callbacks on
// first effect and never paint the blinking caret. The `speed`
// argument is accepted but ignored.
export function useTypewriter(text /* speed unused */) {
  return { displayed: text || "", done: true };
}
