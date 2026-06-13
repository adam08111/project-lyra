import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS } from "../constants.js";
import { sharedStyles as s } from "../styles.js";
import { callAI } from "../api.js";
import { getRouteConfig } from "../ai-router.js";
import { buildTrainingExercisesPrompt, buildTrainingChatPrompt } from "../prompts.js";
import { anonymiseSkillsForAI, restoreAuthorNames } from "../utils.js";
import { extractLearningData, syncLearningData, maybeSaveVisibleReport, saveMasterclassReport } from "../learning-sync.js";
import { parseSectionContent, trimToSentence, deriveShortTitle } from "./XRayView.jsx";
import { TRAINING_EXERCISES_KEY, mergeExercises, normalizeExercises, appendSentence } from "../training-threads.js";

const mono = "'Courier Prime', monospace";

// Pick the active sentence from a technique's list. idx === null → newest (last).
// Clamps so a stale index never reads out of bounds after the list grows/shrinks.
const pickSentence = (list, idx) => {
  const arr = Array.isArray(list) ? list : [];
  if (!arr.length) return "";
  const i = idx == null ? arr.length - 1 : Math.max(0, Math.min(idx, arr.length - 1));
  return arr[i] || "";
};

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
  // exercises[techIdx] is a LIST of practice sentences for that technique (the
  // original + ones the student added after Lyra approved). Persisted per skill
  // (lyra-training-exercises) so the SAME sentences show every return — gate
  // generation on hydration so we never regenerate over a stored set on remount.
  const [exercises, setExercises] = useState(null);
  const [exercisesHydrated, setExercisesHydrated] = useState(false);
  const [generating, setGenerating] = useState(false);
  // Which sentence in the active technique's list is showing. null = newest
  // (so reopening a technique continues at the latest sentence). The pager
  // flips between kept sentences; "Try a new sentence" appends + jumps here.
  const [sentenceIdx, setSentenceIdx] = useState(null);
  // Set when a Lyra turn logs a genuine win (growth/saved report) — gates the
  // "Try a new sentence" offer so it appears exactly when Lyra approves.
  const [approvedActive, setApprovedActive] = useState(false);
  const [addingSentence, setAddingSentence] = useState(false);
  // Brief inline notice when "Try a new sentence" couldn't add one (AI error,
  // empty output, or a duplicate) — so the tap never reads as a dead button.
  const [addSentenceNotice, setAddSentenceNotice] = useState("");
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
  // Which Lyra turn was just copied (by index) — flips the Copy button to
  // "Copied" briefly. Reset when the thread changes (indices then differ).
  const [copiedIdx, setCopiedIdx] = useState(null);
  const copiedTimerRef = useRef(null);
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
  // Live mirror of activeTechIdx so an in-flight addNewSentence (awaiting the
  // AI) can tell, after it resolves, whether the student has since switched
  // technique — and skip the UI-position setters that would clobber the new one.
  const activeTechIdxRef = useRef(activeTechIdx);
  useEffect(() => { activeTechIdxRef.current = activeTechIdx; }, [activeTechIdx]);

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

  // Load persisted exercise sentences for this skill on mount. Without this the
  // sentence regenerated on every remount — the student would lose the sentence
  // they were mid-practice on. `exercisesHydrated` gates generation below.
  useEffect(() => {
    if (!skill?.id) return;
    try {
      const all = JSON.parse(localStorage.getItem(TRAINING_EXERCISES_KEY) || "{}");
      const stored = all[skill.id];
      // Normalise the legacy string-per-slot shape to sentence LISTS on read.
      if (Array.isArray(stored) && stored.length) setExercises(normalizeExercises(stored));
    } catch (e) { /* first time */ }
    setExercisesHydrated(true);
  }, [skill?.id]);

  // Save exercise sentences when they change (after hydration), so a return
  // visit shows the identical sentence.
  useEffect(() => {
    if (!exercisesHydrated || !skill?.id || !exercises) return;
    try {
      const all = JSON.parse(localStorage.getItem(TRAINING_EXERCISES_KEY) || "{}");
      all[skill.id] = exercises;
      localStorage.setItem(TRAINING_EXERCISES_KEY, JSON.stringify(all));
    } catch (e) { /* silent */ }
  }, [exercises, exercisesHydrated, skill?.id]);

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
    setCopiedIdx(null);
    setSentenceIdx(null);     // show the newest sentence for the new technique
    setApprovedActive(false); // approval is per-technique-per-sentence
    setAddSentenceNotice("");
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

  // Copy a Lyra turn to the clipboard. On the LAN-IP preview the page is an
  // INSECURE context, so navigator.clipboard is undefined — fall back to a
  // hidden-textarea execCommand("copy"), which works without HTTPS. This is
  // why students "can't copy" otherwise: there was no copy affordance and
  // long-press selection inside the fixed overlay is unreliable on mobile.
  const copyTurn = useCallback(async (text, idx) => {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (e) { /* fall through to legacy path */ }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (e) { ok = false; }
    }
    if (ok) {
      setCopiedIdx(idx);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedIdx(null), 1600);
    }
  }, []);

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
      // Merge, never overwrite: a persisted sentence the student is practising
      // stays put; only empty slots (new techniques) get filled.
      setExercises(prev => mergeExercises(prev, parsed, techniques.length));
    } catch (e) {
      console.error("Exercise generation failed:", e);
      // Fallback: fill only the still-empty slots with a generic sentence so we
      // don't clobber any sentence already stored/shown.
      setExercises(prev => mergeExercises(
        prev,
        techniques.map((_, i) => ({ index: i, sentence: "The student walked to the library and sat down at a table." })),
        techniques.length
      ));
    }
    setGenerating(false);
  }, [skill, generating, techniques, trackCall]);

  // Add a NEW practice sentence for the active technique — keeping the old ones.
  // Fired from the "Try a new sentence" button that appears when Lyra approves
  // a rewrite, so the student keeps drilling the SAME skill on fresh material.
  const addNewSentence = useCallback(async () => {
    if (activeTechIdx === null || addingSentence || !skill) return;
    const startedTechIdx = activeTechIdx;  // guard against a technique switch mid-call
    const tech = techniques[startedTechIdx];
    if (!tech) return;
    setAddingSentence(true);
    setAddSentenceNotice("");
    let sentence = null;
    try {
      const { anonymised } = anonymiseSkillsForAI([skill]);
      const anonSkill = anonymised[0];
      const anonTechs = anonSkill.analysedTechniques || anonSkill.researchedTechniques
        || (anonSkill.techniques || []).map(t => typeof t === "string" ? { technique: t } : t);
      // Anonymised technique for anti-bias; fall back to the display technique's
      // name/description (never the example — that can carry the author's voice).
      const oneTech = anonTechs[startedTechIdx] || { technique: tech.technique, description: tech.description };
      const avoid = Array.isArray(exercises?.[startedTechIdx]) ? exercises[startedTechIdx] : [];
      const route = getRouteConfig("training_exercise");
      trackCall();
      const result = await callAI(
        buildTrainingExercisesPrompt([oneTech], avoid),
        "Generate the exercise sentence now.",
        false, 1000, route.thinkingBudget, undefined, undefined, route.model
      );
      const cleaned = result.replace(/<!--[\s\S]*?-->/g, "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      sentence = (Array.isArray(parsed) && parsed[0] && parsed[0].sentence) || null;
    } catch (e) {
      console.error("Add-sentence generation failed:", e);
    }

    // Append targets the captured technique, so it's always safe. Compute the
    // result up front: only treat it as a success if the list actually grew
    // (appendSentence de-dupes an exact repeat and returns the array unchanged).
    let added = false, newIdx = 0;
    if (sentence) {
      setExercises(prev => {
        const next = appendSentence(prev, startedTechIdx, sentence);
        const grew = next !== prev && Array.isArray(next?.[startedTechIdx]);
        if (grew) { added = true; newIdx = next[startedTechIdx].length - 1; }
        return next;
      });
    }

    if (added) {
      // Transition note in the (technique-scoped) chat so the continuous thread
      // stays coherent: the next coaching turn sends THIS sentence as the target,
      // and the history now explicitly introduces it instead of trailing the
      // previous sentence's conversation.
      setChatThreads(prev => {
        const key = String(startedTechIdx);
        const cur = prev[key] || [];
        return { ...prev, [key]: [...cur, { role: "lyra", text: `✦ Fresh practice sentence — same skill:\n\n“${sentence}”\n\nRewrite this one using the technique, then send it to me and I'll coach you.` }] };
      });
      // UI-position setters only matter for the screen the student is on now —
      // skip them if they navigated to a different technique while we waited.
      if (activeTechIdxRef.current === startedTechIdx) {
        setSentenceIdx(newIdx);     // jump to the freshly added sentence
        setStudentAttempt("");
        setStudentExplanation("");
        setApprovedActive(false);   // the new sentence hasn't been approved yet
      }
    } else if (activeTechIdxRef.current === startedTechIdx) {
      // No sentence added (error, empty, or duplicate) — keep the offer so the
      // student can retry, and tell them why nothing changed.
      setAddSentenceNotice("Couldn't find a fresh one just now — tap again to retry.");
    }
    setAddingSentence(false);
  }, [activeTechIdx, addingSentence, skill, techniques, exercises, trackCall]);

  // Generate only what's missing, and only after hydration so we never
  // regenerate over a stored set on remount. Fires on first open (nothing
  // stored) and to fill new technique slots (e.g. after "Analyse more").
  useEffect(() => {
    if (!exercisesHydrated || !skill || generating || techniques.length === 0) return;
    // A slot is "missing" if it has no sentences yet (null or empty list).
    const missing = !exercises || techniques.some((_, i) => !exercises[i] || exercises[i].length === 0);
    if (missing) generateExercises();
    // techniques is recomputed each render (new ref), so it's intentionally
    // omitted from deps — the `missing` check + `generating` guard make the
    // body idempotent; exercises/exercisesHydrated drive the real reactivity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercisesHydrated, skill, exercises, generating]);

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
      // Coach on the sentence the student is actually looking at (the active one
      // in this technique's list), not the whole list.
      const exercise = pickSentence(exercises?.[activeTechIdx], sentenceIdx);

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
        // Provenance for the authentic-growth gate: the student's chat inputs
        // for this technique (their rewrite attempts ride in `conversation`
        // as role:'student' turns).
        const studentTexts = conversation.filter(m => m.role === "student").map(m => m.text);
        const syncResult = syncLearningData(learningData, { topic: skill?.authorName || "", forcedTechnique: practisedName, studentTexts });
        savedReport = !!(syncResult && syncResult.savedReport);
      }
      // Lyra approved this rewrite (a real win) → offer a fresh sentence so the
      // student keeps drilling the same skill. growth present OR a report saved.
      if (savedReport || (learningData && Array.isArray(learningData.growth) && learningData.growth.length > 0)) {
        setApprovedActive(true);
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
  }, [activeTechIdx, exercises, sentenceIdx, skill, trackCall, techniques]);

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
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
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
            const exerciseReady = exercises && exercises[i] && exercises[i].length > 0;
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
  const sentenceList = (exercises && activeTechIdx !== null && Array.isArray(exercises[activeTechIdx])) ? exercises[activeTechIdx] : [];
  const effSentenceIdx = sentenceList.length ? (sentenceIdx == null ? sentenceList.length - 1 : Math.max(0, Math.min(sentenceIdx, sentenceList.length - 1))) : 0;
  const activeExercise = sentenceList[effSentenceIdx] || null;

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

          {/* Exercise prompt. When the technique has more than one practice
              sentence (the student added some after Lyra approved), a pager
              flips between them \u2014 old sentences are kept, never refreshed. */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.heading, textTransform: "uppercase", letterSpacing: 1 }}>Rewrite this sentence</div>
              {sentenceList.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => setSentenceIdx(Math.max(0, effSentenceIdx - 1))}
                    disabled={effSentenceIdx === 0}
                    style={{ background: "none", border: "none", cursor: effSentenceIdx === 0 ? "default" : "pointer", color: effSentenceIdx === 0 ? COLORS.border : COLORS.muted, fontSize: 16, lineHeight: 1, padding: "0 4px" }}
                    title="Previous sentence"
                  >{"\u2039"}</button>
                  <span style={{ fontSize: 10, color: COLORS.muted, fontFamily: mono }}>{effSentenceIdx + 1} / {sentenceList.length}</span>
                  <button
                    onClick={() => setSentenceIdx(Math.min(sentenceList.length - 1, effSentenceIdx + 1))}
                    disabled={effSentenceIdx === sentenceList.length - 1}
                    style={{ background: "none", border: "none", cursor: effSentenceIdx === sentenceList.length - 1 ? "default" : "pointer", color: effSentenceIdx === sentenceList.length - 1 ? COLORS.border : COLORS.muted, fontSize: 16, lineHeight: 1, padding: "0 4px" }}
                    title="Next sentence"
                  >{"\u203a"}</button>
                </div>
              )}
            </div>
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
                    {/* Save this turn + Copy — the student can bank any Lyra
                        coaching turn as an Achievement (backstop for when the AI
                        didn't emit the hidden learning-data block), or copy the
                        whole turn out (long-press selection is unreliable on
                        mobile, and the LAN preview blocks navigator.clipboard). */}
                    {m.role === "lyra" && (
                      <div style={{ display: "flex", gap: 6, marginTop: 4, alignSelf: "flex-start", flexWrap: "wrap" }}>
                        <button
                          onClick={() => saveTrainingTurn(m.text, i)}
                          disabled={savedTurns.has(i)}
                          style={{
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
                        <button
                          onClick={() => copyTurn(m.text, i)}
                          style={{
                            background: copiedIdx === i ? (COLORS.green || "#4a8") : "transparent",
                            border: `1px solid ${copiedIdx === i ? (COLORS.green || "#4a8") : COLORS.border}`,
                            color: copiedIdx === i ? "#fff" : COLORS.muted,
                            fontSize: 10, fontWeight: 700, fontFamily: mono,
                            padding: "3px 8px", borderRadius: 7,
                            cursor: "pointer", letterSpacing: 0.3,
                          }}
                          title="Copy Lyra's reply"
                        >
                          {copiedIdx === i ? "✓ Copied" : "⧉ Copy"}
                        </button>
                      </div>
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

          {/* Continue-the-skill offer — appears once Lyra has approved a rewrite
              (a genuine win). Adds a FRESH practice sentence for this technique,
              keeping the old ones (flip back via the pager above). */}
          {approvedActive && (
            <button
              onClick={addNewSentence}
              disabled={addingSentence}
              style={{
                width: "100%", marginBottom: 12, fontSize: 13, fontWeight: 700, fontFamily: mono,
                padding: "11px 16px", borderRadius: 10, cursor: addingSentence ? "default" : "pointer",
                border: `1.5px solid ${COLORS.green || "#4a8"}`,
                background: addingSentence ? COLORS.bg2 : (COLORS.green || "#4a8"),
                color: addingSentence ? COLORS.muted : "#fff",
                animation: "fadeIn 0.25s ease",
              }}
            >
              {addingSentence ? "Finding a fresh sentence…" : "✦ Try this skill on a new sentence"}
            </button>
          )}
          {addSentenceNotice && (
            <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono, marginTop: -4, marginBottom: 12, textAlign: "center" }}>
              {addSentenceNotice}
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
