import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS } from "../constants.js";
import { sharedStyles as s } from "../styles.js";
import { callAI } from "../api.js";
import { getRouteConfig } from "../ai-router.js";
import { buildTrainingExercisesPrompt, buildTrainingChatPrompt } from "../prompts.js";
import { anonymiseSkillsForAI, restoreAuthorNames } from "../utils.js";
import { extractLearningData, syncLearningData, maybeSaveVisibleReport, saveMasterclassReport } from "../learning-sync.js";
import { parseSectionContent, trimToSentence, deriveShortTitle } from "./XRayView.jsx";

const mono = "'Courier Prime', monospace";

// The AI often annotates examples with internal markup like
//   "For them, {being late is weaponised incompetence}[metaphor — comparing
//    an action to a weapon] - see how she talks..."
// {…} wraps a craft fragment, [...] is the labelling commentary. Students
// don't need to see this. Strip the [...] commentary entirely and remove
// the surrounding braces from {...} so the sentence reads as clean English.
// The unstripped version still flows into LYRA_BRAIN via prompts.js, where
// the annotations help Lyra teach. Render-only cleanup, no data mutation.
const cleanExampleForDisplay = (text) => {
  if (!text) return text;
  return text
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\{([^{}]*)\}/g, "$1")
    .replace(/^["“]|["”]$/g, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
};

// Render **bold** and *italic* markdown for Lyra coaching turns. LYRA_BRAIN
// emits bold for vocabulary ingredients and craft callouts; italics wrap
// parallel-universe example sentences. Plain text otherwise. Also strips
// markdown bullet markers ("* ") that would otherwise show as raw asterisks.
const renderMd = (text) => {
  if (!text) return text;
  // First, replace line-starting "* " bullets with a bullet character.
  const bulletFixed = text.replace(/^[ \t]*\*[ \t]+/gm, "  • ");
  // Then split on **bold** and *italic* spans (run bold first so it wins).
  const parts = bulletFixed.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    const italic = part.match(/^\*([^*\n]+)\*$/);
    if (italic) return <em key={i}>{italic[1]}</em>;
    return part;
  });
};

export default function TrainingSession({ skill, onClose, trackCall, startTechIdx = null }) {
  // Internal state. When startTechIdx is provided (per-technique "Practise
  // this technique" launch), jump straight into that technique's exercise
  // screen instead of the overview list. The exercise sentence shows
  // "Loading..." until generateExercises fills it in.
  const hasStart = Number.isInteger(startTechIdx);
  const [screen, setScreen] = useState(hasStart ? "exercise" : "overview");
  const [activeTechIdx, setActiveTechIdx] = useState(hasStart ? startTechIdx : null);
  const [exercises, setExercises] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [studentAttempt, setStudentAttempt] = useState("");
  const [studentExplanation, setStudentExplanation] = useState("");
  // Stuck-chat state — when student clicks "I'm stuck", an inline chat with
  // Lyra opens up. Replaces the old single-question hint flow.
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  // Two-step confirmation for the Delete button. First click flips this to
  // true and the button label morphs to "Tap again to delete"; a second
  // click within ~3.5s wipes the thread. A timer (managed in the click
  // handler) resets the flag if the student doesn't follow through —
  // protects long coaching sessions from a single accidental tap.
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const deleteResetTimerRef = useRef(null);
  // Tracks which Lyra turns the student has saved to Achievements (by index),
  // so the "Save this turn" button can flip to "Saved". Reset when the chat
  // thread changes (technique switch) since indices then point at new turns.
  const [savedTurns, setSavedTurns] = useState(() => new Set());
  const [progress, setProgress] = useState({});
  const [progressLoaded, setProgressLoaded] = useState(false);
  // chatThreads: per-technique chat history persisted to localStorage.
  // Shape: { [techIdx: string]: [{ role: 'lyra'|'student', text: string }] }
  // One bag per skill, keyed by skill.id under "lyra-training-chats".
  // Hydrated alongside progress; chatMessages mirrors the active thread.
  const [chatThreads, setChatThreads] = useState({});
  const [chatHydrated, setChatHydrated] = useState(false);
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);
  const chatScrollRef = useRef(null);

  // chatMessages is a DERIVED view of chatThreads[activeTechIdx] — single
  // source of truth, no separate state to sync. Declared early so downstream
  // effects (auto-scroll) can reference it in their dep arrays without
  // hitting a Temporal Dead Zone.
  const activeTechKey = activeTechIdx !== null ? String(activeTechIdx) : null;
  const chatMessages = activeTechKey ? (chatThreads[activeTechKey] || []) : [];

  // Drop-in replacement for the old chatMessages state setter. Accepts both
  // a fresh array and an updater function (prev => next), matching React's
  // useState API so existing call sites don't need rewriting beyond the
  // identifier name.
  const setChatMessages = useCallback((updater) => {
    if (!activeTechKey) return;
    setChatThreads(prev => {
      const current = prev[activeTechKey] || [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [activeTechKey]: next };
    });
  }, [activeTechKey]);

  // Auto-scroll behaviour:
  // - When Lyra has just replied, anchor the scroll on the student's MOST
  //   RECENT message — the student reads their own question first, then
  //   Lyra's response below it. This keeps the conversational context
  //   visible (the multi-paragraph LYRA_BRAIN reply is still scrollable
  //   downward) instead of pushing the student's question off-screen.
  // - If there's no student message yet (chat opens with Lyra's opening
  //   turn, no question typed), fall back to anchoring Lyra's bubble at
  //   the top so the reader starts at the beginning of her teaching.
  // - When the last message is the student's own, or while Lyra is
  //   thinking, scroll to the bottom (so they see what they just sent /
  //   the loader).
  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg && lastMsg.role === 'lyra' && !chatLoading) {
      // Find the most recent student bubble (the question being answered).
      let anchorIdx = -1;
      for (let i = chatMessages.length - 1; i >= 0; i--) {
        if (chatMessages[i].role === 'student') { anchorIdx = i; break; }
      }
      // No student message yet → anchor on Lyra's bubble (opening turn).
      if (anchorIdx < 0) anchorIdx = chatMessages.length - 1;
      const anchor = container.children[anchorIdx];
      if (anchor) {
        const containerRect = container.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        container.scrollTop = anchorRect.top - containerRect.top + container.scrollTop;
        return;
      }
    }
    container.scrollTop = container.scrollHeight;
  }, [chatMessages, chatLoading]);

  // Extract techniques from skill.
  // For analysed skills, prefer freshly re-parsing from skill.sections[].content
  // when available — the raw section text is the source of truth, while older
  // analysedTechniques in localStorage may carry descriptions that were hard-
  // sliced mid-word by an earlier save bug (e.g. "...late people a"). This
  // heals legacy data without requiring the student to re-analyse the writer.
  //
  // `title` (2-4 word short heading) is taken from:
  //   1. parts.shortTitle parsed from section content (set by new analyses
  //      and by SavedSkills.renameTechnique when a student edits it)
  //   2. skill.analysedTechniques[i].title (parallel array; covers any code
  //      path that writes only to analysedTechniques)
  //   3. deriveShortTitle(keyIdea) — heuristic fallback for legacy skills
  //      saved before SHORT TITLE existed and never renamed
  const techniques = (() => {
    if (Array.isArray(skill?.sections) && skill.sections.length) {
      const fromSections = skill.sections.map((sec, i) => {
        const parts = parseSectionContent(sec.content || "");
        const keyIdea = parts.keyIdea || sec.title;
        const overrideTitle = skill?.analysedTechniques?.[i]?.title;
        return {
          title: parts.shortTitle || overrideTitle || deriveShortTitle(keyIdea),
          technique: keyIdea,
          description: trimToSentence(parts.body || "", 350),
          structure: parts.structure || "",
          example: trimToSentence((parts.example || "").replace(/^["“]|["”]$/g, ""), 250),
        };
      }).filter(t => t.technique);
      if (fromSections.length) return fromSections;
    }
    return skill?.analysedTechniques || skill?.researchedTechniques
      || (skill?.techniques || []).map(t => typeof t === "string" ? { technique: t, description: "", example: "" } : t);
  })();

  // Load progress from localStorage
  useEffect(() => {
    if (!skill?.id) return;
    try {
      const raw = localStorage.getItem("lyra-training-progress");
      if (raw) {
        const all = JSON.parse(raw);
        setProgress(all[skill.id] || {});
      }
    } catch (e) { /* first time */ }
    setProgressLoaded(true);
  }, [skill?.id]);

  // Save progress to localStorage
  useEffect(() => {
    if (!progressLoaded || !skill?.id) return;
    try {
      const all = JSON.parse(localStorage.getItem("lyra-training-progress") || "{}");
      all[skill.id] = progress;
      localStorage.setItem("lyra-training-progress", JSON.stringify(all));
    } catch (e) { /* silent */ }
  }, [progress, progressLoaded, skill?.id]);

  // Load saved chat threads for this skill on mount.
  useEffect(() => {
    if (!skill?.id) return;
    try {
      const raw = localStorage.getItem("lyra-training-chats");
      if (raw) {
        const all = JSON.parse(raw);
        setChatThreads(all[skill.id] || {});
      }
    } catch (e) { /* first time */ }
    setChatHydrated(true);
  }, [skill?.id]);

  // Save chat threads to localStorage when they change.
  useEffect(() => {
    if (!chatHydrated || !skill?.id) return;
    try {
      const all = JSON.parse(localStorage.getItem("lyra-training-chats") || "{}");
      all[skill.id] = chatThreads;
      localStorage.setItem("lyra-training-chats", JSON.stringify(all));
    } catch (e) { /* silent */ }
  }, [chatThreads, chatHydrated, skill?.id]);

  // When the student arrives on a technique, auto-open the chat panel if
  // there's already a saved thread (they're returning to a conversation).
  // If no thread, leave the panel closed — they'll click "I'm stuck" or
  // "Resume" to start one.
  useEffect(() => {
    if (!chatHydrated || activeTechIdx === null) return;
    const stored = chatThreads[String(activeTechIdx)] || [];
    setChatOpen(stored.length > 0);
    setChatInput("");
    setChatLoading(false);
    setSavedTurns(new Set()); // indices point at a different thread now
    // Intentionally NOT in dep list: chatThreads — we only react to
    // technique switches, not to every chatThreads write (which would
    // re-toggle the panel every time a message lands).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTechIdx, chatHydrated]);

  // Manually save a Lyra coaching turn as an Achievements card. Backstop for
  // the Practice flow — the writing chat has the same "Save this turn"
  // affordance. Lifts the polished sentence from an "After:" line or the
  // student's preceding message, tags it with the current technique name.
  const saveTrainingTurn = useCallback((lyraText, idx) => {
    let priorStudent = "";
    for (let j = idx - 1; j >= 0; j--) {
      if (chatMessages[j] && chatMessages[j].role === "student") { priorStudent = chatMessages[j].text; break; }
    }
    const afterMatch = lyraText.match(/After:\s*([^\n]+)/i);
    const after = (afterMatch ? afterMatch[1].trim().replace(/^["“]|["”]$/g, "") : priorStudent || "").trim();
    const tech = (activeTechIdx !== null && techniques[activeTechIdx]) ? (techniques[activeTechIdx].title || techniques[activeTechIdx].technique) : "";
    saveMasterclassReport({
      source: "manual",
      topic: skill?.authorName || "",
      after,
      technique: tech,
      reportText: lyraText,
    });
    setSavedTurns(prev => new Set(prev).add(idx));
  }, [chatMessages, activeTechIdx, techniques, skill]);

  // Focus textarea when exercise screen opens
  useEffect(() => {
    if (screen === "exercise") {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [screen, activeTechIdx]);

  // Generate exercises for all techniques
  const generateExercises = useCallback(async () => {
    if (!skill || generating || techniques.length === 0) return;
    setGenerating(true);
    try {
      const { anonymised } = anonymiseSkillsForAI([skill]);
      const anonSkill = anonymised[0];
      const anonTechs = anonSkill.analysedTechniques || anonSkill.researchedTechniques
        || (anonSkill.techniques || []).map(t => typeof t === "string" ? { technique: t } : t);

      const route = getRouteConfig("training_exercise");
      trackCall();
      const result = await callAI(
        buildTrainingExercisesPrompt(anonTechs),
        "Generate the exercise sentences now.",
        false, 1000, route.thinkingBudget, undefined, undefined, route.model
      );
      const cleaned = result
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/```json|```/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      const exerciseArr = new Array(techniques.length).fill(null);
      for (const item of parsed) {
        if (item.index >= 0 && item.index < techniques.length) {
          exerciseArr[item.index] = item.sentence;
        }
      }
      setExercises(exerciseArr);
    } catch (e) {
      console.error("Exercise generation failed:", e);
      // Fallback: simple generic sentences
      setExercises(techniques.map(() => "The student walked to the library and sat down at a table."));
    }
    setGenerating(false);
  }, [skill, generating, techniques, trackCall]);

  // Auto-generate exercises on first open
  useEffect(() => {
    if (skill && !exercises && !generating) {
      generateExercises();
    }
  }, [skill]);

  // Defensive: if launched directly into a technique that doesn't exist
  // (out-of-range startTechIdx from malformed data), fall back to the
  // overview instead of rendering a blank exercise screen.
  useEffect(() => {
    if (screen === "exercise" && activeTechIdx !== null && techniques.length && !techniques[activeTechIdx]) {
      setActiveTechIdx(null);
      setScreen("overview");
    }
  }, [screen, activeTechIdx, techniques]);

  // Fetch the next Lyra turn given the current conversation.
  // Same Pro-tier model + LYRA_BRAIN as the main coaching chat.
  const fetchLyraTurn = useCallback(async (conversation) => {
    if (activeTechIdx === null) return;
    setChatLoading(true);
    try {
      const { anonymised, mapping } = anonymiseSkillsForAI([skill]);
      const anonSkill = anonymised[0];
      const anonTechs = anonSkill.analysedTechniques || anonSkill.researchedTechniques
        || (anonSkill.techniques || []).map(t => typeof t === "string" ? { technique: t } : t);
      const anonTech = anonTechs[activeTechIdx];
      const exercise = exercises?.[activeTechIdx] || "";

      const route = getRouteConfig("training_hint");
      trackCall();
      // LYRA_BRAIN coaching turns are plain text (multi-paragraph teaching with
      // Parallel Universes, Vocabulary Ingredients, Rhythm Maps). We give the
      // model ~1500 tokens of output budget on top of its thinking budget so
      // it can deploy the full 4-step protocol without getting truncated.
      const rawResult = await callAI(
        buildTrainingChatPrompt(anonTech, exercise, conversation),
        "Write your next coaching turn now.",
        false, (route.thinkingBudget || 0) + 1500, route.thinkingBudget, undefined, undefined, route.model
      );
      // === ANTI-BIAS: Restore real author names ("Writer A" → "Polly Hudson")
      // in the AI response BEFORE display. Without this the Masterclass Report
      // and any other author-references the AI produces stay anonymised, which
      // reads like jargon to students who know the writer by name.
      const result = restoreAuthorNames(rawResult, mapping);
      // LYRA_BRAIN appends a trailing <!--LYRA_LEARNING_DATA ... --> HTML
      // comment carrying structured learning metadata for the app to harvest.
      // Strip it (plus any stray markdown fences) — what remains is the
      // coaching turn itself, displayed verbatim to the student.
      // Harvest hidden learning data (grammar log, growth, structures, vocab)
      // and auto-save an Achievements card the same way the writing chat
      // does — without this, practising a technique to mastery in the
      // Practice Session never produced an Achievement. Then strip the JSON
      // comment + fences for display. If no structured report was saved but
      // Lyra printed a visible MASTERCLASS REPORT, the visible-report
      // fallback captures it.
      const { displayText: synced, learningData } = extractLearningData(result);
      // Name the report after the skill the student is actually practising, not
      // whatever fresh name the AI invents — keeps Achievements/Report names in
      // sync with the Skills list (e.g. "The One Person Reset").
      const practisedName = (activeTechIdx !== null && techniques[activeTechIdx]) ? (techniques[activeTechIdx].title || techniques[activeTechIdx].technique) : "";
      let savedReport = false;
      if (learningData) {
        const syncResult = syncLearningData(learningData, { topic: skill?.authorName || "", forcedTechnique: practisedName });
        savedReport = !!(syncResult && syncResult.savedReport);
      }
      const message = synced
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/```json|```/g, "")
        .trim();
      if (!savedReport) {
        maybeSaveVisibleReport(message, { topic: skill?.authorName || "", forcedTechnique: practisedName });
      }
      if (message) {
        setChatMessages(prev => [...prev, { role: 'lyra', text: message }]);
      }
    } catch (e) {
      console.error("Lyra chat turn failed:", e);
      const fallback = conversation.length === 0
        ? "My coaching engine sputtered. While I reboot, tell me in your own words (English or Cantonese) — what feels stuck about the plain sentence?"
        : "Sorry — my engine just sputtered. Could you tell me again in your own words what you're trying to say? Fragments or Cantonese are fine.";
      setChatMessages(prev => [...prev, { role: 'lyra', text: fallback }]);
    }
    setChatLoading(false);
  }, [activeTechIdx, exercises, skill, trackCall]);

  // Bump the attempts counter for the active technique. The shared progress
  // store is what the overview screen reads to show "N attempts" under each
  // technique title.
  const bumpAttempts = useCallback(() => {
    if (activeTechIdx === null) return;
    const techKey = String(activeTechIdx);
    setProgress(prev => {
      const existing = prev[techKey] || { attempts: 0 };
      return { ...prev, [techKey]: { ...existing, attempts: (existing.attempts || 0) + 1 } };
    });
  }, [activeTechIdx]);

  // Open the chat. If there's a saved thread for this technique, reopen it
  // (preserving everything the student & Lyra have already said). If the
  // thread is empty, this is a fresh "I'm stuck" — kick off Lyra's opening
  // Socratic 4-step turn and bump the attempts counter.
  const openStuckChat = useCallback(() => {
    if (chatLoading || activeTechIdx === null) return;
    setChatOpen(true);
    if (chatMessages.length > 0) return; // returning to an existing chat
    setChatInput("");
    bumpAttempts();
    fetchLyraTurn([]);
  }, [chatLoading, activeTechIdx, chatMessages, bumpAttempts, fetchLyraTurn]);

  // Delete the saved chat thread for the current technique using a
  // two-step inline confirmation:
  //   - 1st click: flips deleteConfirming → button morphs to
  //     "Tap again to delete" + a Cancel chip appears. A 3.5s timer
  //     resets the flag if the student walks away.
  //   - 2nd click (while deleteConfirming is true): actually wipes the
  //     thread, closes the panel, and resets all chat state.
  // Native confirm() was rejected — students on mobile can dismiss it
  // by reflex; an inline two-step is impossible to miss and impossible
  // to bypass with muscle memory.
  const clearChatThread = useCallback(() => {
    if (activeTechIdx === null) return;
    // Nothing to delete on an empty thread — just close the panel and
    // reset the confirmation flag in case it was hanging from before.
    if (chatMessages.length === 0) {
      setDeleteConfirming(false);
      if (deleteResetTimerRef.current) { clearTimeout(deleteResetTimerRef.current); deleteResetTimerRef.current = null; }
      setChatOpen(false);
      return;
    }
    if (!deleteConfirming) {
      // First click — arm the confirmation and start the auto-reset timer.
      setDeleteConfirming(true);
      if (deleteResetTimerRef.current) clearTimeout(deleteResetTimerRef.current);
      deleteResetTimerRef.current = setTimeout(() => {
        setDeleteConfirming(false);
        deleteResetTimerRef.current = null;
      }, 3500);
      return;
    }
    // Second click — actually delete.
    if (deleteResetTimerRef.current) { clearTimeout(deleteResetTimerRef.current); deleteResetTimerRef.current = null; }
    setDeleteConfirming(false);
    const techKey = String(activeTechIdx);
    setChatThreads(prev => {
      if (!(techKey in prev)) return prev;
      const next = { ...prev };
      delete next[techKey];
      return next;
    });
    setChatOpen(false);
    setChatInput("");
    setChatLoading(false);
  }, [activeTechIdx, chatMessages, deleteConfirming]);

  // Cancel a pending delete confirmation explicitly (Cancel chip click) or
  // implicitly (panel closed, technique switched). Single source of truth
  // for "abandon the half-confirmed delete".
  const cancelDeleteConfirm = useCallback(() => {
    if (deleteResetTimerRef.current) { clearTimeout(deleteResetTimerRef.current); deleteResetTimerRef.current = null; }
    setDeleteConfirming(false);
  }, []);

  // Reset the pending-confirmation flag whenever the chat panel closes or
  // the active technique changes — so the next time the panel opens it
  // doesn't show a stale "Tap again to delete" state.
  useEffect(() => {
    if (!chatOpen) cancelDeleteConfirm();
  }, [chatOpen, cancelDeleteConfirm]);
  useEffect(() => {
    cancelDeleteConfirm();
  }, [activeTechIdx, cancelDeleteConfirm]);

  // Clean up the timer on unmount so we don't fire setState on a dead
  // component (e.g. when the student closes the whole training session
  // mid-confirmation).
  useEffect(() => () => {
    if (deleteResetTimerRef.current) clearTimeout(deleteResetTimerRef.current);
  }, []);

  // Open the chat in "review" mode: the student's rewrite gets added as a
  // student turn and Lyra evaluates it conversationally. If a saved thread
  // already exists for this technique, the rewrite gets APPENDED to it
  // (preserving the previous coaching) rather than replacing.
  const openReviewChat = useCallback(() => {
    if (chatLoading || activeTechIdx === null) return;
    const rewrite = studentAttempt.trim();
    if (!rewrite) return;
    const next = [...chatMessages, { role: 'student', text: rewrite }];
    setChatOpen(true);
    setChatMessages(next);
    setChatInput("");
    setStudentExplanation(rewrite);
    bumpAttempts();
    fetchLyraTurn(next);
  }, [chatLoading, activeTechIdx, studentAttempt, chatMessages, bumpAttempts, fetchLyraTurn]);

  // Send a student message and fetch Lyra's next turn.
  const sendStudentMessage = useCallback(() => {
    if (chatLoading) return;
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const next = [...chatMessages, { role: 'student', text: trimmed }];
    setChatMessages(next);
    setChatInput("");
    // Carry the student's latest thinking into studentExplanation so the
    // evaluator has context about how they reasoned about the technique.
    setStudentExplanation(trimmed);
    fetchLyraTurn(next);
  }, [chatLoading, chatInput, chatMessages, fetchLyraTurn]);

  // Step linearly to the next technique, wrapping back to the start. The old
  // "skip already-mastered" logic is gone now that there is no scoring path.
  // Chat state is NOT reset here — the hydration effect (keyed on
  // activeTechIdx) will swap chatMessages to the saved thread for the next
  // technique, or to [] if that technique has never been chatted with.
  const goNext = useCallback(() => {
    if (!techniques.length) { setScreen("overview"); return; }
    const next = ((activeTechIdx ?? -1) + 1) % techniques.length;
    setActiveTechIdx(next);
    setStudentAttempt("");
    setStudentExplanation("");
    setScreen("exercise");
  }, [activeTechIdx, techniques]);

  // Start practising a technique. Chat state is NOT reset — the hydration
  // effect restores any saved thread for this technique.
  const startTechnique = (idx) => {
    setActiveTechIdx(idx);
    setStudentAttempt("");
    setStudentExplanation("");
    setScreen("exercise");
  };

  if (!skill) return null;

  // === OVERVIEW SCREEN ===
  if (screen === "overview") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 110, background: COLORS.bg1, display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto", fontFamily: mono, animation: "fadeIn 0.25s ease" }}>
        {/* Header */}
        <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${COLORS.border}`, background: COLORS.card, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: COLORS.muted, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}>{"\u2190"}</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.heading }}>Practice Session</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{skill.authorName}</div>
          </div>
        </div>

        {/* Subhead — explains the flow now that there is no scoring */}
        <div style={{ padding: "12px 18px", background: COLORS.card, borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>
            {techniques.length} {techniques.length === 1 ? "technique" : "techniques"} — tap one, write your rewrite, then chat with Lyra.
          </span>
        </div>

        {/* Loading state */}
        {generating && (
          <div style={{ padding: "24px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>Preparing exercises...</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: COLORS.accent1, animation: `bounce 0.6s ${i * 0.15}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {/* Technique list */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 18px" }}>
          {techniques.map((t, i) => {
            const p = progress[String(i)];
            const tried = (p?.attempts || 0) > 0;
            const exerciseReady = exercises && exercises[i];
            return (
              <button
                key={i}
                onClick={() => exerciseReady && startTechnique(i)}
                disabled={!exerciseReady}
                style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 14px", marginBottom: 8, borderRadius: 10,
                  border: `1.5px solid ${tried ? COLORS.blue + "60" : COLORS.border}`,
                  background: COLORS.card,
                  cursor: exerciseReady ? "pointer" : "default",
                  opacity: exerciseReady ? 1 : 0.5,
                  fontFamily: mono, transition: "all 0.2s",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.heading, lineHeight: 1.3 }}>
                    {t.title || t.technique}
                  </div>
                  {t.title && t.technique && t.title !== t.technique && (
                    <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4, lineHeight: 1.4, fontWeight: 400 }}>
                      {t.technique}
                    </div>
                  )}
                  {tried && (
                    <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 3 }}>{p.attempts} attempt{p.attempts !== 1 ? "s" : ""}</div>
                  )}
                </div>
                <span style={{ fontSize: 18, color: COLORS.muted, flexShrink: 0 }}>{"›"}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // === EXERCISE SCREEN ===
  const activeTech = activeTechIdx !== null ? techniques[activeTechIdx] : null;
  const activeExercise = exercises && activeTechIdx !== null ? exercises[activeTechIdx] : null;

  if (screen === "exercise" && activeTech) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 110, background: COLORS.bg1, display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto", fontFamily: mono, animation: "fadeIn 0.2s ease" }}>
        {/* Header. Back behaviour depends on how we got here: a per-technique
            direct launch (hasStart) has no overview to return to \u2014 it sits on
            top of the StyleLab skill detail \u2014 so back CLOSES the session and
            reveals that detail. A launch from the overview list goes back to
            the overview as normal. */}
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${COLORS.border}`, background: COLORS.card, flexShrink: 0 }}>
          <button onClick={() => { if (hasStart) onClose(); else setScreen("overview"); }} style={{ background: "none", border: "none", fontSize: 20, color: COLORS.muted, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}>{"\u2190"}</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.heading }}>Technique {activeTechIdx + 1} of {techniques.length}</div>
            <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 1 }}>{skill.authorName}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {/* Technique card — concise but grounded. Shows the technique name, a
              one-paragraph description, and the writer's actual sentence so
              students have a concrete anchor before attempting the rewrite.
              The abstract structure pattern is intentionally hidden — it's
              piped into LYRA_BRAIN via buildTrainingChatPrompt and Lyra
              surfaces it on demand when the student opens the stuck chat. */}
          <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.blue}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.blue, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Technique</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.heading, lineHeight: 1.3, marginBottom: 6 }}>{activeTech.title || activeTech.technique}</div>
            {activeTech.title && activeTech.technique && activeTech.title !== activeTech.technique && (
              <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.5, marginBottom: activeTech.description ? 6 : 0, fontWeight: 600 }}>
                {activeTech.technique}
              </div>
            )}
            {activeTech.description && (
              <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.6 }}>{activeTech.description}</div>
            )}
            {activeTech.example && (
              <div style={{ background: COLORS.bg2, borderLeft: `3px solid ${COLORS.accent1}`, borderRadius: 6, padding: "8px 12px", marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.accent1, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Like this</div>
                <div style={{ fontSize: 12, color: COLORS.heading, fontStyle: "italic", lineHeight: 1.55 }}>
                  {"“"}{cleanExampleForDisplay(activeTech.example)}{"”"}
                </div>
              </div>
            )}
          </div>

          {/* Exercise prompt */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.heading, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Rewrite this sentence</div>
            <div style={{ background: "#FFF8F0", border: `1.5px solid ${COLORS.amber}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, color: COLORS.heading, lineHeight: 1.6, fontStyle: "italic" }}>
              {"\u201c"}{activeExercise || "Loading..."}{"\u201d"}
            </div>
          </div>

          {/* Student attempt textarea */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.heading, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Your rewrite</div>
            <textarea
              ref={textareaRef}
              value={studentAttempt}
              onChange={e => setStudentAttempt(e.target.value)}
              placeholder={"Write your rewrite here..."}
              style={{
                width: "100%", minHeight: 100, padding: "12px 14px", borderRadius: 10,
                border: `1.5px solid ${COLORS.border}`, background: COLORS.card,
                fontFamily: mono, fontSize: 13, color: COLORS.text, lineHeight: 1.6,
                resize: "vertical", boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6, lineHeight: 1.45 }}>
              Lyra will read your rewrite and tell you what's working.
            </div>
          </div>

          {/* Stuck-chat \u2014 multi-turn conversation with Lyra. Replaces the
              old single-question hint card so students can ask follow-ups. */}
          {chatOpen && (
            <div style={{ background: COLORS.blue + "0A", border: `1.5px solid ${COLORS.blue}30`, borderRadius: 10, padding: "12px 14px", marginBottom: 12, animation: "fadeIn 0.25s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.blue, textTransform: "uppercase", letterSpacing: 1 }}>
                  {"\uD83D\uDCAC"} Chat with Lyra
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {chatMessages.length > 0 && (
                    deleteConfirming ? (
                      <>
                        <button
                          onClick={cancelDeleteConfirm}
                          style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 10, fontWeight: 600, cursor: "pointer", padding: "3px 8px", fontFamily: mono, textTransform: "uppercase", letterSpacing: 0.4, lineHeight: 1.2, borderRadius: 6 }}
                          title="Keep the chat"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={clearChatThread}
                          style={{ background: COLORS.red || "#c44", border: `1px solid ${COLORS.red || "#c44"}`, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "3px 8px", fontFamily: mono, textTransform: "uppercase", letterSpacing: 0.4, lineHeight: 1.2, borderRadius: 6 }}
                          title="Tap again to confirm deletion"
                        >
                          Tap again to delete
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={clearChatThread}
                        style={{ background: "transparent", border: "none", color: COLORS.red || "#c44", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "2px 6px", fontFamily: mono, textTransform: "uppercase", letterSpacing: 0.5, lineHeight: 1 }}
                        title="Delete this chat \u2014 starts fresh next time"
                      >
                        Delete
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setChatOpen(false)}
                    style={{ background: "transparent", border: "none", color: COLORS.muted, fontSize: 16, cursor: "pointer", padding: 0, lineHeight: 1 }}
                    title="Close chat (keeps history)"
                  >
                    {"\u2715"}
                  </button>
                </div>
              </div>

              {/* Chat message thread. Taller than a one-question hint card
                  because LYRA_BRAIN coaching turns are multi-paragraph (4-step
                  protocol with vocabulary ingredients and parallel universes). */}
              <div ref={chatScrollRef} style={{
                maxHeight: 450, overflowY: "auto", padding: "4px 2px",
                display: "flex", flexDirection: "column", gap: 10,
                marginBottom: 10,
              }}>
                {chatMessages.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === "student" ? "flex-end" : "flex-start", maxWidth: "92%", display: "flex", flexDirection: "column", alignItems: m.role === "student" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      background: m.role === "student" ? COLORS.blue : COLORS.bg2,
                      color: m.role === "student" ? "#fff" : COLORS.heading,
                      border: m.role === "lyra" ? `1px solid ${COLORS.border}` : "none",
                      borderRadius: m.role === "student" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                      padding: "10px 14px",
                      fontSize: 13, lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                      animation: "fadeIn 0.2s ease",
                    }}>
                      {m.role === "lyra" ? renderMd(m.text) : m.text}
                    </div>
                    {/* Save this turn — manual backstop so the student can
                        bank any Lyra coaching turn as an Achievement, even
                        if the AI didn't emit the hidden learning-data block. */}
                    {m.role === "lyra" && (
                      <button
                        onClick={() => saveTrainingTurn(m.text, i)}
                        disabled={savedTurns.has(i)}
                        style={{
                          marginTop: 4, alignSelf: "flex-start",
                          background: savedTurns.has(i) ? (COLORS.green || "#4a8") : "transparent",
                          border: `1px solid ${savedTurns.has(i) ? (COLORS.green || "#4a8") : COLORS.border}`,
                          color: savedTurns.has(i) ? "#fff" : (COLORS.green || "#4a8"),
                          fontSize: 10, fontWeight: 700, fontFamily: mono,
                          padding: "3px 8px", borderRadius: 7,
                          cursor: savedTurns.has(i) ? "default" : "pointer",
                          letterSpacing: 0.3,
                        }}
                      >
                        {savedTurns.has(i) ? "✓ Saved to Achievements" : "★ Save this turn"}
                      </button>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div style={{
                    alignSelf: "flex-start", maxWidth: "85%",
                    background: COLORS.bg2, color: COLORS.muted,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "4px 14px 14px 14px",
                    padding: "8px 12px",
                    fontSize: 12, fontStyle: "italic",
                  }}>
                    Lyra is thinking...
                  </div>
                )}
              </div>

              {/* Input row */}
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendStudentMessage();
                    }
                  }}
                  placeholder="Reply to Lyra..."
                  disabled={chatLoading}
                  style={{
                    flex: 1, minHeight: 38, maxHeight: 100, padding: 8, borderRadius: 8,
                    border: `1.5px solid ${COLORS.border}`, background: COLORS.card,
                    fontFamily: mono, fontSize: 12,
                    color: COLORS.text, resize: "none", boxSizing: "border-box",
                    opacity: chatLoading ? 0.6 : 1,
                  }}
                />
                <button
                  onClick={sendStudentMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  style={{
                    fontSize: 12, fontWeight: 700, fontFamily: mono,
                    padding: "8px 14px", borderRadius: 8,
                    border: "none",
                    background: (chatInput.trim() && !chatLoading) ? COLORS.blue : COLORS.bg2,
                    color: (chatInput.trim() && !chatLoading) ? "#fff" : COLORS.muted,
                    cursor: (chatInput.trim() && !chatLoading) ? "pointer" : "default",
                    whiteSpace: "nowrap",
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {!chatOpen && (
              <button
                onClick={openStuckChat}
                disabled={chatLoading}
                style={{
                  ...s.chip, fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${COLORS.blue}`, background: "transparent",
                  color: COLORS.blue, opacity: chatLoading ? 0.5 : 1,
                }}
              >
                {chatLoading ? "Thinking..." : (chatMessages.length > 0 ? "Resume chat with Lyra" : "I'm stuck — chat with Lyra")}
              </button>
            )}
            {!chatOpen && (
              <button
                onClick={openReviewChat}
                disabled={!studentAttempt.trim() || chatLoading}
                style={{
                  ...s.btn, flex: 1, fontSize: 14, padding: "12px 24px",
                  opacity: (!studentAttempt.trim() || chatLoading) ? 0.5 : 1,
                  background: COLORS.heading,
                }}
              >
                {chatLoading ? "Sending..." : "Check my rewrite \u2192"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback — shouldn't happen
  return null;
}
