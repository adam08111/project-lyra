import { useState, useCallback } from "react";

// §104 (D1) — training-launcher state, lifted verbatim out of lyra.jsx as the first
// decomposition seam. It holds ONLY which skill/technique the Training overlay should open
// (null = closed). Verified in the §104 seam map: NO other domain reads or writes this
// state — the sole touch points are these two callbacks and the
// `{trainingSkill && <TrainingSession .../>}` render conditionals — and it is never
// persisted (not in autoSave / saveNewWriting / loadWriting) nor reset by resetToNew. So
// this is a pure lift: identical useState + useCallbacks, only relocated. Behaviour frozen.
// trainingStartTech is the technique index to jump straight into (per-technique "Practise
// this technique"); null opens the overview list.
export function useTrainingLauncher() {
  const [trainingSkill, setTrainingSkill] = useState(null);
  const [trainingStartTech, setTrainingStartTech] = useState(null);
  const openTrainingSession = useCallback((skill, techIdx) => {
    setTrainingStartTech(Number.isInteger(techIdx) ? techIdx : null);
    setTrainingSkill(skill);
  }, []);
  const closeTrainingSession = useCallback(() => {
    setTrainingSkill(null);
    setTrainingStartTech(null);
  }, []);
  return { trainingSkill, trainingStartTech, openTrainingSession, closeTrainingSession };
}

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
