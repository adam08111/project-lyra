import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS, FONTS_LINK, writingTypes, getExamRules } from "./constants.js";
import { keyframes, sharedStyles as s } from "./styles.js";
import { callAI } from "./api.js";
import { getRouteConfig } from "./ai-router.js";
import { buildCoachPrompt, buildScaffoldingPrompt, buildStructuralPrompt, buildProofreadPrompt, buildWelcomePrompt, buildMessageTranslatePrompt } from "./prompts.js";
import { FALLBACK_WELCOME, chooseWelcome, shouldSuppressWelcomeBanner } from "./welcome.js";
import { parseTechniques, anonymiseSkillsForAI, restoreAuthorNames, ANTI_BIAS_BLOCK, upsertSwitchNotice, extractJsonObject, groupGrammarByRule } from "./utils.js";
import { extractLearningData, syncLearningData, saveMasterclassReport, maybeSaveVisibleReport } from "./learning-sync.js";
import { getStudentContext } from "./growth-report.js";
import WordLookup from "./components/WordLookup.jsx";
import { snapshotBackup } from "./backup.js";
import { LyraAvatar } from "./components/Icons.jsx";
import Onboarding from "./components/Onboarding.jsx";
import SourceSetup from "./components/SourceSetup.jsx";
import ChatTab from "./components/ChatTab.jsx";
import EditorTab from "./components/EditorTab.jsx";
import GrammarLog from "./components/GrammarLog.jsx";
import StyleLab from "./components/StyleLab.jsx";
import Sidebar from "./components/Sidebar.jsx";
import TrainingSession from "./components/TrainingSession.jsx";
import { generateTitle, swapTitleTypePrefix } from "./titleGenerator.js";
import { detectFormatCue, typeLabelOf } from "./genre-cues.js";
import { nextHeaderCollapsed } from "./header-collapse.js";

export default function Lyra() {
  // Core state
  const [screen, setScreen] = useState("source-setup");
  const [userName, setUserName] = useState("");
  const [userNameLoaded, setUserNameLoaded] = useState(false);
  const [topic, setTopic] = useState("");
  const [type, setType] = useState(null);
  const [wordCount, setWordCount] = useState(null);
  const [purpose, setPurpose] = useState(null);
  const [tab, setTab] = useState("chat");
  const [apiCalls, setApiCalls] = useState(0);
  const apiCallRef = useRef(0);

  const trackCall = useCallback(() => {
    apiCallRef.current += 1;
    setApiCalls(apiCallRef.current);
  }, []);

  // Chat
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [typingMsg, setTypingMsg] = useState(null);
  const chatAbortRef = useRef(null);
  const proofAbortRef = useRef(null); // §61: in-flight proofread call, so × / timeout can abort it

  // Editor
  const [title, setTitle] = useState("Untitled");
  const [editingTitle, setEditingTitle] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false); // §41: collapses on chat scroll
  const [titleExpanded, setTitleExpanded] = useState(false);     // §41: tap clamped title → full text
  const titleInputRef = useRef(null);
  const [draft, setDraft] = useState("");

  // Panels
  const [suggestions, setSuggestions] = useState(null);
  const [sugBadge, setSugBadge] = useState(false);
  const [proofread, setProofread] = useState(null);
  const [proofTab, setProofTab] = useState("grammar");
  const [proofLoading, setProofLoading] = useState(false);
  const sugTimer = useRef(null);
  const lastAnalysed = useRef("");
  const [appliedSuggestions, setAppliedSuggestions] = useState([]);
  const [checkFlash, setCheckFlash] = useState(false);

  // Grammar Log
  const [grammarLog, setGrammarLog] = useState([]);
  const [showGrammarLog, setShowGrammarLog] = useState(false);
  const [grammarLogLoaded, setGrammarLogLoaded] = useState(false);
  const [miniLesson, setMiniLesson] = useState({});

  // Style Lab
  const [showStyleLab, setShowStyleLab] = useState(false);
  const [styleLabInitialTab, setStyleLabInitialTab] = useState(null);
  const [appliedSkill, setAppliedSkill] = useState(null);
  const [writingTechniques, setWritingTechniques] = useState(null);
  const [techsEnriching, setTechsEnriching] = useState(false);
  const [pendingSkillsOpen, setPendingSkillsOpen] = useState(false);

  // Training Session. trainingStartTech is the technique index to jump
  // straight into (per-technique "Practise this technique"); null = open the
  // overview list as before.
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

  // Source text (new unified flow)
  const [sourceText, setSourceText] = useState("");
  const [sourceAnalysis, setSourceAnalysis] = useState("");
  const [extractedSkills, setExtractedSkills] = useState(null);
  const [targetVoice, setTargetVoice] = useState("");

  // Sidebar & Projects
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState([{ id: "default", name: "My Writings", writings: [] }]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [activeWritingId, setActiveWritingId] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [expandedProjects, setExpandedProjects] = useState({ "default": true });

  // Welcome (§43): the opening greeting is now a model-generated message[0],
  // not a template banner. typedWelcome guards "generate once per session open".
  const typedWelcome = useRef(false);
  // §34/X2b: true while the greeting is generating — lets Stop clear the
  // optimistic welcomeHandledCue (stopChat nulls chatAbortRef, so the catch's
  // own ownership guard can't detect a Stop).
  const welcomeStreamingRef = useRef(false);
  // True when the generated greeting itself raised a genre-cue mismatch — the
  // separate §28 banner then defers to it. Persisted per writing.
  const [welcomeHandledCue, setWelcomeHandledCue] = useState(false);

  // Genre-mismatch tripwire: the student's decision for THIS writing
  // ("switched:<type>" | "kept:<type>" | null), persisted on the writing
  // record so the banner never re-nags on remount. pendingTypeSwitchNote
  // carries a one-time context line into the NEXT sendChat after a switch.
  const [genreCueDecision, setGenreCueDecision] = useState(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [hoverTypeId, setHoverTypeId] = useState(null); // picker row under the pointer
  const pendingTypeSwitchNote = useRef(null);

  // Derived values
  const typeLabel = type ? writingTypes.find(w => w.id === type)?.label : "";
  const examRules = getExamRules(purpose, type);
  const wcLabel = wordCount === "600+" ? "600+" : wordCount;
  // §41: the header collapses to a compact row only while scrolled into the chat.
  const headerCondensed = tab === "chat" && headerCollapsed;
  // Leaving chat resets the collapse: re-entering lands at the top of the
  // thread, so the header should be expanded — not a stale collapsed row.
  useEffect(() => { if (tab !== "chat") setHeaderCollapsed(false); }, [tab]);
  const currentWords = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const targetNum = wordCount === "600+" ? 600 : (wordCount || 100);
  const progress = Math.min(100, (currentWords / targetNum) * 100);
  const goalReached = currentWords >= targetNum;

  // === STORAGE EFFECTS ===

  // Load user name
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("lyra-user-name");
        if (result?.value) setUserName(result.value);
      } catch (e) { /* first time */ }
      setUserNameLoaded(true);
    })();
  }, []);

  // Save user name
  useEffect(() => {
    if (!userNameLoaded) return;
    (async () => {
      try { await window.storage.set("lyra-user-name", userName); } catch (e) { /* silent */ }
    })();
  }, [userName, userNameLoaded]);

  // Load projects
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("lyra-projects");
        if (result?.value) setProjects(JSON.parse(result.value));
      } catch (e) { /* first time */ }
      setProjectsLoaded(true);
    })();
  }, []);

  // === LOCAL BACKUP SAFETY NET ===
  // Snapshot all critical localStorage keys to lyra-backup-v1 so a stray
  // wipe is recoverable on next load (autoRestoreFromBackup runs in main.jsx
  // before mount). The snapshot reads localStorage directly, so it captures
  // writes from every component (skills, training chats, achievements), not
  // just this one's React state. Triggers: an initial snapshot a few seconds
  // after load, a light 30s interval, on tab-hide, and on unload.
  useEffect(() => {
    const initial = setTimeout(snapshotBackup, 3000);
    const interval = setInterval(snapshotBackup, 30000);
    const onHide = () => { if (document.visibilityState === "hidden") snapshotBackup(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", snapshotBackup);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", snapshotBackup);
    };
  }, []);

  // Save projects
  useEffect(() => {
    if (!projectsLoaded) return;
    (async () => {
      try { await window.storage.set("lyra-projects", JSON.stringify(projects)); } catch (e) { /* silent */ }
    })();
  }, [projects, projectsLoaded]);

  // Load grammar log
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("grammar-log");
        if (result?.value) setGrammarLog(JSON.parse(result.value));
      } catch (e) { /* no saved log yet */ }
      setGrammarLogLoaded(true);
    })();
  }, []);

  // Save grammar log
  useEffect(() => {
    if (!grammarLogLoaded) return;
    (async () => {
      try { await window.storage.set("grammar-log", JSON.stringify(grammarLog)); } catch (e) { /* silent */ }
    })();
  }, [grammarLog, grammarLogLoaded]);

  // === AUTO-SAVE ===

  // Auto-save the active writing. We DO NOT require `draft.trim()` to be
  // non-empty — students often chat with Lyra (brainstorming, asking for an
  // outline, vocabulary, parallel-universe examples) before they've written
  // a single word in the draft. Those chat messages must persist so the
  // student can reload the writing later and review what Lyra taught them.
  // Skipping when the draft is empty would silently drop the entire pre-draft
  // coaching conversation.
  const autoSave = useCallback(() => {
    if (!activeWritingId || screen !== "app") return;
    setProjects(prev => prev.map(p => ({
      ...p,
      writings: p.writings.map(w => w.id === activeWritingId ? {
        ...w, title, draft, messages, topic, type, wordCount, purpose, genreCueDecision, welcomeHandledCue, updatedAt: new Date().toISOString(),
      } : w)
    })));
  }, [activeWritingId, title, draft, messages, topic, type, wordCount, purpose, genreCueDecision, welcomeHandledCue, screen]);

  const saveTimer = useRef(null);
  useEffect(() => {
    if (!activeWritingId || screen !== "app") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(autoSave, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [draft, messages, title, autoSave, activeWritingId, screen]);

  // === PROJECT OPERATIONS ===

  const saveNewWriting = useCallback((projectId = "default", overrideTitle) => {
    const id = "w_" + Date.now();
    const writing = {
      id, title: overrideTitle || title, topic, type, wordCount, purpose, draft, messages, welcomeHandledCue,
      sourceText: sourceText || undefined,
      sourceAnalysis: sourceAnalysis || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, writings: [writing, ...p.writings] } : p));
    setActiveWritingId(id);
    return id;
  }, [title, topic, type, wordCount, purpose, draft, messages, welcomeHandledCue, sourceText, sourceAnalysis]);

  const loadWriting = useCallback((writing) => {
    setTopic(writing.topic || "");
    setType(writing.type || null);
    setGenreCueDecision(writing.genreCueDecision || null);
    setWelcomeHandledCue(writing.welcomeHandledCue || false);
    setWordCount(writing.wordCount || null);
    setPurpose(writing.purpose || null);
    setTitle(writing.title || "Untitled");
    setDraft(writing.draft || "");
    setMessages(writing.messages || []);
    setSourceText(writing.sourceText || "");
    setSourceAnalysis(writing.sourceAnalysis || "");
    setActiveWritingId(writing.id);
    setScreen("app");
    setTab("preview");
    // §43: an existing writing keeps its persisted greeting (messages[0]) — but
    // if it somehow has NO messages (e.g. the +500ms saveNewWriting snapshot
    // raced ahead of the streamed greeting and the student navigated away before
    // autoSave caught up), regenerate a fresh greeting instead of opening to a
    // permanently empty chat.
    typedWelcome.current = (writing.messages || []).length > 0;
    chatAbortRef.current?.abort(); // cancel any in-flight greeting/turn from the prior writing
    // §61 protocol: abort + NULL the proofread controller too, so a proofread
    // started on the prior writing can't resolve into THIS one — nulling the ref
    // makes runProofread's ownership guard reject the late run (it would otherwise
    // still equal ctrl and contaminate the new writing's Grammar Log).
    proofAbortRef.current?.abort();
    proofAbortRef.current = null;
    setProofLoading(false);
    setTypingMsg(null);
    setSuggestions(null);
    setProofread(null);
    setAppliedSuggestions([]);
    setApiCalls(0);
    apiCallRef.current = 0;
    setSidebarOpen(false);
  }, []);

  const createProject = useCallback(() => {
    const id = "p_" + Date.now();
    setProjects(prev => [...prev, { id, name: "New Project", writings: [] }]);
    setEditingProjectId(id);
    setEditingProjectName("New Project");
    setExpandedProjects(prev => ({ ...prev, [id]: true }));
  }, []);

  const renameProject = useCallback((id, name) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    setEditingProjectId(null);
  }, []);

  const deleteProject = useCallback((id) => {
    if (id === "default") return;
    setProjects(prev => {
      const proj = prev.find(p => p.id === id);
      return prev.filter(p => p.id !== id).map(p => p.id === "default" ? { ...p, writings: [...(proj?.writings || []), ...p.writings] } : p);
    });
  }, []);

  const moveWriting = useCallback((writingId, fromProjectId, toProjectId) => {
    setProjects(prev => {
      let writing = null;
      return prev.map(p => {
        if (p.id === fromProjectId) {
          writing = p.writings.find(w => w.id === writingId);
          return { ...p, writings: p.writings.filter(w => w.id !== writingId) };
        }
        if (p.id === toProjectId && writing) {
          return { ...p, writings: [writing, ...p.writings] };
        }
        return p;
      });
    });
  }, []);

  const deleteWriting = useCallback((writingId, projectId) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, writings: p.writings.filter(w => w.id !== writingId) } : p));
    if (activeWritingId === writingId) setActiveWritingId(null);
  }, [activeWritingId]);

  const [homeKey, setHomeKey] = useState(0);
  const resetToNew = useCallback(() => {
    setSidebarOpen(false);
    setScreen("source-setup");
    setTopic("");
    setType(null);
    setGenreCueDecision(null);
    setShowTypePicker(false);
    pendingTypeSwitchNote.current = null;
    setWordCount(null);
    setMessages([]);
    setDraft("");
    setTitle("Untitled");
    setHeaderCollapsed(false);
    setTitleExpanded(false);
    typedWelcome.current = false;          // §43: New regenerates a fresh greeting
    setWelcomeHandledCue(false);
    chatAbortRef.current?.abort();         // cancel any in-flight greeting/turn
    // §61 protocol: also abort + null the proofread controller and clear its
    // spinner, or "New" leaves an orphaned proofread that resolves onto the blank
    // writing (phantom spinner + stale Grammar-Log rows). Nulling defeats the
    // late run via runProofread's ownership guard.
    proofAbortRef.current?.abort();
    proofAbortRef.current = null;
    setProofLoading(false);
    setTypingMsg(null);
    setSuggestions(null);
    setProofread(null);
    setAppliedSuggestions([]);
    setAppliedSkill(null);
    setWritingTechniques(null);
    setSourceText("");
    setSourceAnalysis("");
    setExtractedSkills(null);
    setTargetVoice("");
    setApiCalls(0);
    apiCallRef.current = 0;
    setActiveWritingId(null);
    // Remount SourceSetup so its internal step resets to 1. Otherwise, when we're
    // already on the source-setup screen, setScreen is a no-op and "+ New Writing"
    // (and the Lyra logo) would clear the fields but leave you on the same sub-step.
    setHomeKey(k => k + 1);
  }, []);

  // Non-destructive mid-session type switch (genre banner / header chip):
  // updates type state only — draft, chat history, skills all untouched.
  // typeLabel + examRules are derived per render and the coach prompt is
  // built at send time, so the next turn automatically carries the right
  // convention block. Appends a LOCAL (no-API) confirmation message and arms
  // a one-time context note for the next sendChat.
  const switchWritingType = useCallback((newTypeId) => {
    if (!newTypeId || newTypeId === type) { setShowTypePicker(false); return; }
    const oldLabel = typeLabel || "(none)";
    const newLabel = writingTypes.find(w => w.id === newTypeId)?.label || newTypeId;
    setType(newTypeId);
    setGenreCueDecision("switched:" + newTypeId);
    // Let the picker's highlight + ✓ visibly land on the chosen type before
    // it closes — 280ms was imperceptible on phones (tap latency + refocus),
    // so the student thought the click hadn't registered.
    setTimeout(() => setShowTypePicker(false), 700);
    pendingTypeSwitchNote.current = { from: oldLabel, to: newLabel };
    // Replace a directly-preceding switch notice instead of stacking them
    // (toying with the picker used to leave four in a row).
    setMessages(prev => upsertSwitchNotice(prev, `Switched to ${newLabel}. I'll coach for that now — the conventions are different.`));
    // If the title still carries the OLD auto-generated "{Type} — " prefix
    // (never customised), track the new type; custom titles stay untouched.
    setTitle(prev => swapTitleTypePrefix(prev, oldLabel, newLabel));
  }, [type, typeLabel]);

  const startEditingTitle = useCallback(() => {
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 10);
  }, []);

  const finishEditingTitle = useCallback(() => {
    setEditingTitle(false);
    if (!title.trim()) setTitle("Untitled");
  }, [title]);

  // === AI FEATURES ===

  const fetchMiniLesson = useCallback(async (entry) => {
    if (miniLesson[entry.id]?.content) {
      setMiniLesson(prev => { const n = { ...prev }; delete n[entry.id]; return n; });
      return;
    }
    setMiniLesson(prev => ({ ...prev, [entry.id]: { loading: true } }));
    try {
      const lessonRoute = getRouteConfig("grammar_lesson");
      trackCall();
      const result = await callAI(
        `You are a fun, friendly English grammar teacher. The student keeps making a specific grammar mistake. Give a BRIEF concept card about this grammar rule.

FORMAT your response EXACTLY like this (plain text, no markdown):
RULE: [rule name]
WHAT IT IS: [1-2 sentence explanation, simple language]
THE TRICK: [a memorable shortcut or trick to remember the rule]
EXAMPLES:
✗ [funny wrong example - make it absurd or relatable]
✓ [corrected version]
✗ [another funny wrong example]
✓ [corrected version]
✗ [one more funny wrong example]
✓ [corrected version]
REMEMBER: [one punchy line the student won't forget - humorous]

Rules:
- Keep it SHORT. Max 150 words total.
- Examples should be FUNNY, absurd, or relatable to young people (social media, school, food, pets, gaming)
- No formal language. Talk like a cool teacher.
- Do NOT repeat the student's original mistake. Create fresh, different examples.`,
        `The student made this mistake: "${entry.phrase}" → "${entry.correction}"\nThe grammar rule is: ${entry.rule}\nTheir explanation was: ${entry.explanation}`,
        false, 1000, lessonRoute.thinkingBudget, undefined, undefined, lessonRoute.model
      );
      setMiniLesson(prev => ({ ...prev, [entry.id]: { loading: false, content: result } }));
    } catch (e) {
      setMiniLesson(prev => ({ ...prev, [entry.id]: { loading: false, content: "Couldn't load lesson. Try again!" } }));
    }
  }, [miniLesson, trackCall]);

  // Welcome message
  // §43 — Generated, in-voice opening greeting, STREAMED as messages[0], with
  // the template (FALLBACK_WELCOME) as the failure floor. Fires ONCE per
  // session open and ONLY when the chat is empty — an EXISTING writing keeps
  // its persisted first message (messages already populated → skip), while
  // "New" clears messages + typedWelcome so a fresh greeting generates.
  useEffect(() => {
    if (screen !== "app" || typedWelcome.current || messages.length > 0) return;
    typedWelcome.current = true;
    (async () => {
      const route = getRouteConfig("welcome");
      const rawCue = detectFormatCue(topic);
      const cue = (rawCue && type && rawCue.typeId !== type) ? rawCue : null; // mismatch only
      const fallbackArgs = { name: userName, type: typeLabel, topic, wordCount: wcLabel };
      if (cue) setWelcomeHandledCue(true); // optimistic — the greeting is told to raise it
      welcomeStreamingRef.current = true;
      const abortCtrl = new AbortController();
      chatAbortRef.current = abortCtrl;
      let firstChunk = true;
      trackCall();
      setChatLoading(true);
      try {
        const full = await callAI(
          buildWelcomePrompt({ name: userName, type: typeLabel, purpose, wordCount: wcLabel, topic, cue }),
          "(The student just opened the session — write your opening greeting now.)",
          false, 1024, route.thinkingBudget,
          (partial) => {
            if (!partial) return;
            if (firstChunk) { firstChunk = false; setChatLoading(false); }
            setMessages(prev => [{ role: "ai", text: partial }, ...prev.slice(1)]);
          },
          abortCtrl.signal, route.model
        );
        welcomeStreamingRef.current = false;
        // Ownership guard: if the student already sent a message while the
        // greeting streamed, sendChat has taken over chatAbortRef — don't clear
        // ITS spinner or flip banner state from this orphaned greeting. The
        // messages[0] finalize is safe (it only fixes the greeting text).
        const stillMine = chatAbortRef.current === abortCtrl;
        if (stillMine) chatAbortRef.current = null;
        const text = chooseWelcome(full, null, fallbackArgs);
        setMessages(prev => [{ role: "ai", text }, ...prev.slice(1)]);
        if (stillMine) {
          setChatLoading(false);
          setWelcomeHandledCue(shouldSuppressWelcomeBanner(!!cue, !!(full && full.trim())));
        }
      } catch (e) {
        welcomeStreamingRef.current = false;
        const stillMine = chatAbortRef.current === abortCtrl;
        if (stillMine) chatAbortRef.current = null;
        if (e.name === "AbortError") return; // navigated away mid-greeting — leave it
        setMessages(prev => [{ role: "ai", text: FALLBACK_WELCOME(fallbackArgs) }, ...prev.slice(1)]);
        if (stillMine) {
          setChatLoading(false);
          setWelcomeHandledCue(false); // template is genre-blind → keep the §28 banner
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Finalize typewriter when switching away from chat tab
  // Prevents the animation restarting from scratch when switching back
  useEffect(() => {
    if (tab !== "chat" && typingMsg) {
      const entry = { role: "ai", text: typingMsg.text };
      if (Array.isArray(typingMsg.sources) && typingMsg.sources.length) entry.sources = typingMsg.sources;
      if (typingMsg.id != null) entry.id = typingMsg.id;
      if (typingMsg.reqText != null) { entry.reqText = typingMsg.reqText; entry.reqSearch = !!typingMsg.reqSearch; entry.reqScaffold = !!typingMsg.reqScaffold; }
      setMessages(prev => [...prev, entry]);
      setTypingMsg(null);
    }
  }, [tab, typingMsg]);

  // Structural suggestions trigger
  useEffect(() => {
    if (sugTimer.current) clearTimeout(sugTimer.current);
    if (!draft || draft.length < 50) return;
    const paragraphs = draft.split(/\n\n+/).filter(p => p.trim().split(/\s+/).length >= 12);
    if (paragraphs.length === 0) return;
    const lastPara = paragraphs[paragraphs.length - 1].trim();
    if (lastPara === lastAnalysed.current) return;
    sugTimer.current = setTimeout(async () => {
      try {
        // SKILL-AWARE: Build anonymised active skill context so suggestions don't contradict deployed techniques
        let activeSkillCtx = null;
        if (appliedSkill) {
          const { anonymised } = anonymiseSkillsForAI([appliedSkill]);
          const anonSkill = anonymised[0];
          const techs = anonSkill.analysedTechniques || anonSkill.researchedTechniques
            || (anonSkill.techniques || []).map(t => typeof t === 'string' ? { technique: t } : t);
          activeSkillCtx = {
            name: techs.map(t => t.technique).join(", "),
            style: anonSkill.signatureStyle || "",
            techniques: techs.map(t => `${t.technique}${t.description ? ` — ${t.description}` : ""}`).join("; "),
          };
        }

        const sugRoute = getRouteConfig("structural_suggest");
        trackCall();
        const result = await callAI(buildStructuralPrompt(topic, typeLabel, activeSkillCtx, examRules), lastPara, false, 1000, sugRoute.thinkingBudget, undefined, undefined, sugRoute.model);
        const parsed = JSON.parse(result.replace(/```json|```/g, "").trim());
        if (parsed.suggestions?.length) {
          setSuggestions(parsed.suggestions);
          setSugBadge(true);
          lastAnalysed.current = lastPara;
        }
      } catch (e) { /* silent */ }
    }, 2500);
    return () => clearTimeout(sugTimer.current);
    // §34/H5: typeLabel + examRules are read inside (buildStructuralPrompt) — a
    // type switch within the 2.5s debounce must reschedule with the new type's
    // convention/formality block, not fire the previous type's snapshot.
  }, [draft, appliedSkill, typeLabel, examRules]);

  const sendChat = useCallback(async (text, useSearch = false, scaffolding = false, historyMsgs = null) => {
    if (!text.trim()) return;
    // §53: when historyMsgs is supplied this is a RELOAD — re-fire WITHOUT
    // appending a duplicate user message, and use the supplied history (the
    // conversation before the originating user turn) instead of the `messages`
    // closure, so it doesn't depend on a not-yet-flushed setMessages.
    const isReload = historyMsgs !== null;
    const userMsg = { role: "user", text: text.trim() };
    if (!isReload) setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    setTypingMsg(null);

    // Create abort controller for this request
    const abortCtrl = new AbortController();
    chatAbortRef.current = abortCtrl;

    try {
      // Build conversation history with roles so Lyra knows who said what.
      // The §43 greeting is messages[0], so it's already included here.
      const allMsgs = isReload ? historyMsgs : [...messages];
      const history = allMsgs.length > 0
        ? "=== CONVERSATION SO FAR ===\n" + allMsgs.map(m => `${m.role === "user" ? "Student" : "Lyra"}: ${m.text}`).join("\n\n") + "\n=== END CONVERSATION ===\n\n"
        : "";

      // Send full draft (up to 3000 chars) so Lyra can reference specific sentences
      const ctx = draft ? `\n\n[STUDENT'S CURRENT DRAFT — ${currentWords} words — read this carefully and reference specific parts when coaching:\n${draft.slice(0, 3000)}${draft.length > 3000 ? "\n... (truncated)" : ""}]` : "";

      // === ANTI-BIAS: Anonymise all skill references before sending to AI ===
      let nameMapping = []; // Store mapping for restoring names in AI response

      // Load all saved skills and anonymise them
      let savedSkills = [];
      try { savedSkills = JSON.parse(localStorage.getItem("lyra-style-skills") || "[]"); } catch (e) {}

      let skillCtx = "";
      let allSkillsCtx = "";
      let antiBiasPrefix = "";

      if (savedSkills.length > 0 || appliedSkill) {
        const { anonymised, mapping } = anonymiseSkillsForAI(savedSkills);
        nameMapping = mapping;

        // Build anonymised applied-skill context
        if (appliedSkill) {
          const idx = savedSkills.findIndex(s => s.authorName === appliedSkill.authorName);
          const anonLabel = idx >= 0 ? mapping[idx].writerLabel : "Writer X";
          const anonTechs = idx >= 0 && anonymised[idx].techniques
            ? (Array.isArray(anonymised[idx].techniques) ? anonymised[idx].techniques.map(t => typeof t === 'string' ? t : t.technique).join(", ") : "")
            : (appliedSkill.techniques || []).join(", ");
          const anonSig = idx >= 0 ? (anonymised[idx].signatureStyle || "") : "";
          skillCtx = `\n\n[APPLIED SKILL: The student has chosen to apply ${anonLabel}'s writing style. Key techniques: ${anonTechs}. Signature: ${anonSig}. When coaching, reference these techniques where relevant and encourage the student to use them.]`;
        }

        // Build anonymised all-skills context
        if (anonymised.length > 0) {
          const list = anonymised.map(s => `${s.authorName}: ${s.signatureStyle || (Array.isArray(s.techniques) ? s.techniques.map(t => typeof t === 'string' ? t : t.technique).join(", ") : "") || ""}`).join("; ");
          allSkillsCtx = `\n\n[STUDENT'S STYLE SKILLS: The student has studied these writing styles: ${list}. You may reference these when giving feedback or suggestions.]`;
        }

        // Add anti-bias block when skills are present
        antiBiasPrefix = ANTI_BIAS_BLOCK;
      }

      const techCtx = writingTechniques?.length
        ? `\n\n[WRITING TECHNIQUES: The student was shown these researched techniques for this task:\n${writingTechniques.map((t, i) => `${i + 1}. "${t.technique}" — ${t.description}`).join("\n")}\nReference these techniques when coaching the student.]`
        : "";
      // One-time note after a mid-session type switch, then dropped.
      let switchNote = "";
      if (pendingTypeSwitchNote.current) {
        const { from, to } = pendingTypeSwitchNote.current;
        switchNote = `\n\n[NOTE: the writing type was changed from ${from} to ${to} mid-session; acknowledge briefly and coach for ${to}.]`;
        pendingTypeSwitchNote.current = null;
      }
      const fullMsg = `${history}Student says: ${text.trim()}${ctx}${skillCtx}${techCtx}${allSkillsCtx}${switchNote}`;
      const chatRoute = getRouteConfig(scaffolding ? "scaffolding" : "chat_coaching");
      trackCall();
      // Build source context for prompt grounding (if source text was analysed)
      const sourceCtxObj = sourceAnalysis && appliedSkill ? {
        authorName: appliedSkill.authorName || "Unknown",
        targetVoice: targetVoice || appliedSkill.signatureStyle || "",
        techniqueCount: extractedSkills?.length || appliedSkill.analysedTechniques?.length || 0,
      } : null;
      // §66: coach FROM the growth profile — Lyra walks in already knowing this
      // student (scaffolding is for a stuck blank-page student → no memory needed).
      const baseSysPrompt = scaffolding ? buildScaffoldingPrompt(topic, typeLabel, wcLabel, examRules, sourceCtxObj) : buildCoachPrompt(topic, typeLabel, wcLabel, examRules, sourceCtxObj, useSearch, getStudentContext());
      const sysPrompt = antiBiasPrefix ? baseSysPrompt + antiBiasPrefix : baseSysPrompt;
      // §67: maxTokens from the route (16384 for coaching) so a full numbered
      // every-sentence critique + logic pass can't truncate — thinking counts toward
      // the output cap, so the old shared 4096 truncated the sweep to a sample.
      let result = await callAI(sysPrompt, fullMsg, useSearch, chatRoute.maxTokens || 8192, chatRoute.thinkingBudget, undefined, abortCtrl.signal, chatRoute.model);

      // When useSearch=true, callAI returns { text, sources } instead of a
      // raw string. Unpack here so downstream helpers (restoreAuthorNames,
      // extractLearningData) which expect a string don't blow up on the
      // object. Stash sources so the message bubble can render them as
      // attribution links.
      let sources = [];
      if (result && typeof result === "object" && typeof result.text === "string") {
        sources = Array.isArray(result.sources) ? result.sources : [];
        result = result.text;
      }

      // === ANTI-BIAS: Restore real author names in the AI response for display ===
      result = restoreAuthorNames(result, nameMapping);

      // === LEARNING SYNC: Extract hidden learning data before display ===
      const { displayText, learningData } = extractLearningData(result);
      let savedReport = false;
      if (learningData) {
        // Provenance for the authentic-growth gate: everything the student
        // actually authored this session — prior user messages, the message
        // just sent, and the current draft.
        const studentTexts = [
          ...messages.filter(m => m.role === "user").map(m => m.text),
          userMsg.text,
          draft || "",
        ];
        const syncResult = syncLearningData(learningData, { setGrammarLog, topic, studentTexts });
        savedReport = !!(syncResult && syncResult.savedReport);
      }
      // Fallback: if the structured learning-data path didn't save an
      // Achievements card but Lyra printed a visible MASTERCLASS REPORT in
      // the chat, capture it as a freeform card so the milestone isn't lost
      // (the model often prints the report but omits/partial-emits the
      // hidden JSON block).
      if (!savedReport) {
        maybeSaveVisibleReport(displayText, { topic });
      }

      setChatLoading(false);
      chatAbortRef.current = null;
      // §53: stash the request params so the message's Reload action can re-fire
      // the SAME call (see reloadChat + canReloadMessage).
      setTypingMsg({ role: "ai", text: displayText, sources, id: Date.now(), reqText: text.trim(), reqSearch: useSearch, reqScaffold: scaffolding });
    } catch (e) {
      setChatLoading(false);
      chatAbortRef.current = null;
      // Only show error if it wasn't a user-initiated abort
      if (e.name !== "AbortError") {
        setMessages(prev => [...prev, { role: "ai", text: "I'm having trouble connecting. Please try again." }]);
      }
    }
  }, [messages, draft, topic, typeLabel, wcLabel, currentWords, appliedSkill, writingTechniques, examRules, sourceAnalysis, extractedSkills, targetVoice]);

  const stopChat = useCallback(() => {
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
      chatAbortRef.current = null;
    }
    // §34/X2b: Stopping the optimistic greeting (cue not yet raised) must release
    // the §28 genre-banner suppression — otherwise it stays hidden all session.
    if (welcomeStreamingRef.current) { welcomeStreamingRef.current = false; setWelcomeHandledCue(false); }
    setChatLoading(false);
    // If there's a typing message in progress, finish it immediately
    if (typingMsg) {
      const entry = { role: "ai", text: typingMsg.text };
      if (Array.isArray(typingMsg.sources) && typingMsg.sources.length) entry.sources = typingMsg.sources;
      setMessages(prev => [...prev, entry]);
      setTypingMsg(null);
    }
  }, [typingMsg]);

  // === APPLY SKILL WITH ROLE CLASSIFICATION + AUTO-ENRICHMENT ===
  const REQUIRED_ROLES = ["point", "evidence", "explanation", "link"];
  const ROLE_DESCRIPTIONS = {
    point: "writing a clear topic sentence that states the main argument",
    evidence: "introducing or framing evidence, quotes, or data to support the point",
    explanation: "explaining and analysing the evidence in depth",
    link: "linking the paragraph back to the question or forward to the next point",
  };

  const applySkillWithEnrichment = useCallback(async (skill) => {
    // 1. Extract raw techniques
    const rawTechs = skill.analysedTechniques || skill.researchedTechniques
      || (skill.techniques || []).map(t => ({ technique: t }));
    if (!rawTechs.length) { setAppliedSkill(skill); return; }

    // 2. Fast AI call to classify paragraph roles (no web search)
    //    ANTI-BIAS: Anonymise skill before PEEL classification to prevent author-biased role assignment
    let techniquesWithRoles = rawTechs.map(t => ({ ...t }));
    try {
      const { anonymised: anonSkills } = anonymiseSkillsForAI([skill]);
      const anonTechs = anonSkills[0]?.analysedTechniques || anonSkills[0]?.researchedTechniques
        || (anonSkills[0]?.techniques || []).map(t => typeof t === 'string' ? { technique: t } : t);
      const techList = anonTechs.map((t, i) => `${i}. "${t.technique}": ${t.description || ""}`).join("\n");
      const classifyPrompt = `The student is writing a ${typeLabel || "piece"} about: "${(topic || "").slice(0, 200)}".\nThey have these writing techniques (from an anonymous writer they studied):\n${techList}\n\nFor each technique, decide which part of a PEEL body paragraph it best helps with:\n- "point" \u2014 writing the topic/point sentence\n- "evidence" \u2014 introducing or framing evidence/quotes\n- "explanation" \u2014 explaining or analysing the evidence\n- "link" \u2014 linking back to the question or to the next paragraph\n- "hook" \u2014 for opening hooks (introduction only)\n- "conclusion" \u2014 for concluding sentences\n\nReturn a JSON array of objects, one per technique, in order:\n[{"index":0,"role":"point"}, {"index":1,"role":"evidence"}, ...]`;
      const peelRoute = getRouteConfig("peel_classify");
      const roleResult = await callAI("Return only valid JSON array. No markdown, no explanation, no commentary — just the JSON. Do NOT attempt to identify the writer.", classifyPrompt, false, 4096, peelRoute.thinkingBudget, undefined, undefined, peelRoute.model);
      const roleText = typeof roleResult === "string" ? roleResult : roleResult.text;
      const jsonMatch = roleText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const roles = JSON.parse(jsonMatch[0]);
        for (const r of roles) {
          if (r.index >= 0 && r.index < techniquesWithRoles.length && r.role) {
            techniquesWithRoles[r.index].paragraphRole = r.role.toLowerCase().replace(/[^a-z]/g, "");
          }
        }
      }
    } catch (e) { /* classification failed — display without roles */ }

    // 3. Show techniques immediately
    setAppliedSkill(skill);
    setWritingTechniques(techniquesWithRoles);
    trackCall();

    // 4. Check coverage gaps
    const coveredRoles = new Set(techniquesWithRoles.map(t => t.paragraphRole).filter(Boolean));
    const missingRoles = REQUIRED_ROLES.filter(r => !coveredRoles.has(r));

    // 5. If gaps, search the web for complementary techniques
    if (missingRoles.length > 0 && topic) {
      setTechsEnriching(true);
      try {
        const coveredStr = [...coveredRoles].join(", ") || "none";
        const missingStr = missingRoles.join(", ");
        const roleDescs = missingRoles.map(r => ROLE_DESCRIPTIONS[r]).join("; ");
        const sysPrompt = "You are a writing coach that researches real articles via Google Search and extracts actionable writing techniques for students. Always search the web \u2014 do not guess.";
        const userPrompt = `The student is writing a ${typeLabel || "piece"} about: "${(topic || "").slice(0, 200)}".\nThey already have writing techniques for these paragraph parts: ${coveredStr}.\nThey need techniques specifically for: ${missingStr}.\n\nSearch the web for expert articles about writing strong ${(typeLabel || "writing").toLowerCase()} paragraphs.\nFocus on: ${roleDescs}.\n\nExtract exactly ${missingRoles.length} specific writing technique${missingRoles.length > 1 ? "s" : ""}, one per missing part.\n\nFormat as numbered sections (one per technique). Inside each section use bold labels (not numbered sub-items):\n\n1. **Technique name here**\n**What to do:** 1-2 sentences explaining the technique clearly\n**Example:** a concrete example applied to the student's topic\n**Paragraph role:** one of: ${missingStr}\n**Source:** [Article Title](https://url)`;
        const enrichRoute = getRouteConfig("skill_enrich");
        const enrichResult = await callAI(sysPrompt, userPrompt, true, 2048, enrichRoute.thinkingBudget, undefined, undefined, enrichRoute.model);
        const enriched = parseTechniques(enrichResult);
        if (enriched) {
          // Ensure each has a paragraphRole
          for (const t of enriched) {
            if (!t.paragraphRole && missingRoles.length === 1) {
              t.paragraphRole = missingRoles[0];
            }
          }
          setWritingTechniques(prev => prev ? [...prev, ...enriched] : enriched);
          trackCall();
        }
      } catch (e) { /* enrichment failed — continue with existing techniques */ }
      setTechsEnriching(false);
    }
  }, [topic, typeLabel]);

  const handleTypewriterDone = useCallback((msg) => {
    // Carry sources (web-search grounding attributions) + the §53 reload params
    // (id, reqText/reqSearch/reqScaffold) from typingMsg into the saved message
    // so they persist on re-render / reload.
    const entry = { role: "ai", text: msg.text };
    if (Array.isArray(msg.sources) && msg.sources.length) entry.sources = msg.sources;
    if (msg.id != null) entry.id = msg.id;
    if (msg.reqText != null) { entry.reqText = msg.reqText; entry.reqSearch = !!msg.reqSearch; entry.reqScaffold = !!msg.reqScaffold; }
    setMessages(prev => [...prev, entry]);
    setTypingMsg(null);
  }, []);

  // §53: regenerate this AI turn — drop the reply (keep the originating user
  // message + the prior history) and re-fire the SAME request via sendChat's
  // historyMsgs path (no duplicate user message). Reconstructable only when the
  // message kept reqText (canReloadMessage); the row disables reload otherwise.
  // The new reply streams in through the normal typingMsg path, and its
  // learning-sync runs again on the fresh message.
  const reloadChat = useCallback((i) => {
    const m = messages[i];
    if (!m || m.role !== "ai" || !m.reqText) return;
    let j = -1;
    for (let k = i - 1; k >= 0; k--) { if (messages[k].role === "user") { j = k; break; } }
    const historyMsgs = j >= 0 ? messages.slice(0, j) : [];
    setMessages(prev => prev.slice(0, i)); // keep [0..i-1]: originating user msg + history; drop the reply
    sendChat(m.reqText, !!m.reqSearch, !!m.reqScaffold, historyMsgs);
  }, [messages, sendChat]);

  // §53: translate ONE coaching message to flowing 繁中 on demand (lite tier,
  // thinkingBudget 0). Returns the translation; the caller caches it on the
  // message so a re-tap toggles instantly with no second call.
  const translateText = useCallback(async (text) => {
    const route = getRouteConfig("translate");
    trackCall();
    const result = await callAI(buildMessageTranslatePrompt(), text, false, 4096, route.thinkingBudget, undefined, undefined, route.model);
    return (typeof result === "string" ? result : (result && result.text) || "").trim();
  }, [trackCall]);

  // Add a student's chat sentence to the essay draft
  const addToDraft = useCallback((text) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    setDraft(prev => {
      if (!prev.trim()) return cleaned;
      // Add as a new paragraph (double newline) if draft already has content
      return prev.trimEnd() + "\n\n" + cleaned;
    });
  }, []);

  const runProofread = useCallback(async () => {
    if (!draft.trim()) return;
    setProofLoading(true);
    setProofread(null);

    // SKILL-AWARE: Build anonymised active skill context so proofread doesn't contradict deployed techniques
    let activeSkillCtx = null;
    if (appliedSkill) {
      const { anonymised } = anonymiseSkillsForAI([appliedSkill]);
      const anonSkill = anonymised[0];
      const techs = anonSkill.analysedTechniques || anonSkill.researchedTechniques
        || (anonSkill.techniques || []).map(t => typeof t === 'string' ? { technique: t } : t);
      activeSkillCtx = {
        name: techs.map(t => t.technique).join(", "),
        style: anonSkill.signatureStyle || "",
        techniques: techs.map(t => `${t.technique}${t.description ? ` — ${t.description}` : ""}`).join("; "),
      };
    }

    const proofRoute = getRouteConfig("proofread");
    // §66: proofread also reads the growth profile — a thin name-list of this
    // student's known weak patterns so Lite looks hardest where they slip.
    const sys = buildProofreadPrompt(topic, typeLabel, appliedSuggestions, activeSkillCtx, examRules, undefined, getStudentContext());
    // §61: make the call abortable (the × cancels it) and bound it with a client-side
    // soft timeout, so the heavier §59 call (cap ~100 + grouping) can never trap the
    // student on an eternal "Doing the magic" spinner.
    const ctrl = new AbortController();
    proofAbortRef.current = ctrl;
    let timedOut = false;
    const softTimeout = setTimeout(() => { timedOut = true; ctrl.abort(); }, 60000);

    // The Lite tier sometimes returns prose, or fenced/preamble/truncated JSON.
    // Parse defensively (extractJsonObject) and RETRY ONCE before giving up (§57).
    let parsed = null;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      try {
        trackCall();
        // 8192: thinking tokens count toward maxOutputTokens, and §59 raised the cap
        // to ~100 (grouped) so the payload is larger; pass ctrl.signal so the × and
        // the soft timeout can abort the in-flight fetch.
        const result = await callAI(sys, draft, false, 8192, proofRoute.thinkingBudget, undefined, ctrl.signal, proofRoute.model);
        const obj = extractJsonObject(result);
        // A usable result has at least one of the three arrays.
        if (obj && (Array.isArray(obj.grammar) || Array.isArray(obj.style) || Array.isArray(obj.vocabulary))) parsed = obj;
      } catch (e) {
        if (ctrl.signal.aborted) break; // user cancel or timeout — don't retry
        /* prose / truncated / malformed — retry once, then error state */
      }
    }
    clearTimeout(softTimeout);

    // Ownership guard: if the × (cancelProofread) or a newer run superseded this one,
    // it already reset the panel — don't clobber that state.
    if (proofAbortRef.current !== ctrl) return;
    proofAbortRef.current = null;

    if (!parsed) {
      // Never a silent or eternal spinner — a visible, retryable error (see EditorTab).
      setProofread({ error: timedOut ? "This is taking too long — please try again." : "Couldn't check this right now — please try again." });
      setProofLoading(false);
      return;
    }

    setProofread(parsed);
    setProofTab("grammar");
    if (parsed.grammar?.length) {
      // §59: save ONE grammar-log entry per RULE-GROUP (a representative instance),
      // not one per occurrence — don't spam the log with 30 rows for one rule.
      const newEntries = groupGrammarByRule(parsed.grammar).map(grp => ({
        id: Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        phrase: grp.instances[0]?.wrong || "",
        correction: grp.instances[0]?.right || "",
        rule: grp.rule,
        explanation: grp.explanation,
        example_wrong: grp.example_wrong || "",
        example_correct: grp.example_correct || "",
        // §73: writing id (resolves the full title live) + a topic-snippet fallback.
        writingId: activeWritingId,
        topic: (topic || "Untitled").slice(0, 200),
      }));
      setGrammarLog(prev => [...newEntries, ...prev]);
      setCheckFlash(true);
      setTimeout(() => setCheckFlash(false), 2000);
    }
    setProofLoading(false);
  }, [draft, topic, typeLabel, appliedSuggestions, appliedSkill, examRules]);

  // §61: the × must close the proofread panel in EVERY state — including mid-load —
  // and abort the in-flight call so it doesn't keep running into a closed panel.
  const cancelProofread = useCallback(() => {
    if (proofAbortRef.current) { proofAbortRef.current.abort(); proofAbortRef.current = null; }
    setProofLoading(false);
    setProofread(null);
  }, []);

  // "I've rewritten it" — student signals they've rewritten, Lyra verifies in chat
  const applySuggestion = useCallback((sug) => {
    // Record that this suggestion was attempted (for proofread awareness)
    setAppliedSuggestions(prev => [...prev, { technique: sug.technique, original: sug.original }]);
    setSuggestions(null);
    // Switch to chat and ask Lyra to verify the student's rewrite
    setTab("chat");
    sendChat(`I just tried to apply "${sug.technique}" to improve this sentence in my draft: "${sug.original}"\n\nCheck my current draft — did I apply the technique correctly? If not, guide me to fix it.`);
  }, [sendChat]);

  // === SIDEBAR PROPS ===

  const sidebarProps = {
    sidebarOpen, setSidebarOpen, projects, setProjects, activeWritingId,
    expandedProjects, setExpandedProjects, editingProjectId, setEditingProjectId,
    editingProjectName, setEditingProjectName, createProject, renameProject,
    deleteProject, moveWriting, deleteWriting, loadWriting,
    onNewWriting: resetToNew, grammarLog, setShowStyleLab,
    onHome: resetToNew,
  };

  // === SOURCE SETUP SCREEN (new unified flow) ===

  if (screen === "source-setup") {
    return (
      <>
        <SourceSetup
          key={homeKey}
          userName={userName} setUserName={setUserName}
          topic={topic} setTopic={setTopic}
          type={type} setType={setType}
          wordCount={wordCount} setWordCount={setWordCount}
          purpose={purpose} setPurpose={setPurpose}
          sourceText={sourceText} setSourceText={setSourceText}
          sourceAnalysis={sourceAnalysis} setSourceAnalysis={setSourceAnalysis}
          extractedSkills={extractedSkills} setExtractedSkills={setExtractedSkills}
          targetVoice={targetVoice} setTargetVoice={setTargetVoice}
          appliedSkill={appliedSkill} setAppliedSkill={setAppliedSkill}
          setWritingTechniques={setWritingTechniques}
          onStart={() => { const autoTitle = generateTitle(topic, type); setTitle(autoTitle); setScreen("app"); setTimeout(() => saveNewWriting("default", autoTitle), 500); }}
          trackCall={trackCall}
          sidebarProps={sidebarProps}
          onOpenTraining={openTrainingSession}
        />
        <StyleLab showStyleLab={showStyleLab} setShowStyleLab={setShowStyleLab} setSidebarOpen={setSidebarOpen} projects={projects} trackCall={trackCall} setAppliedSkill={setAppliedSkill} setWritingTechniques={setWritingTechniques} initialTab={styleLabInitialTab} onOpenTraining={openTrainingSession} writingType={type} />
        <WordLookup trackCall={trackCall} />
        {trainingSkill && <TrainingSession skill={trainingSkill} startTechIdx={trainingStartTech} onClose={closeTrainingSession} trackCall={trackCall} />}
      </>
    );
  }

  // === ONBOARDING SCREEN (legacy — for loaded writings without source) ===

  if (screen === "onboarding") {
    return (
      <>
        <Onboarding
          userName={userName} setUserName={setUserName}
          topic={topic} setTopic={setTopic}
          type={type} setType={setType}
          wordCount={wordCount} setWordCount={setWordCount}
          purpose={purpose} setPurpose={setPurpose}
          appliedSkill={appliedSkill} setAppliedSkill={setAppliedSkill}
          setWritingTechniques={setWritingTechniques}
          onStart={() => { const autoTitle = generateTitle(topic, type); setTitle(autoTitle); setScreen("app"); setTimeout(() => saveNewWriting("default", autoTitle), 500); }}
          sidebarProps={sidebarProps}
        />
        <StyleLab showStyleLab={showStyleLab} setShowStyleLab={setShowStyleLab} setSidebarOpen={setSidebarOpen} projects={projects} trackCall={trackCall} setAppliedSkill={setAppliedSkill} setWritingTechniques={setWritingTechniques} initialTab={styleLabInitialTab} onOpenTraining={openTrainingSession} writingType={type} />
        <WordLookup trackCall={trackCall} />
        {trainingSkill && <TrainingSession skill={trainingSkill} startTechIdx={trainingStartTech} onClose={closeTrainingSession} trackCall={trackCall} />}
      </>
    );
  }

  // === MAIN APP ===

  return (
    <div style={s.app}>
      <style>{keyframes}</style>
      <link href={FONTS_LINK} rel="stylesheet" />

      {/* Header (§41): resting layout caps the title at 2 lines and keeps the
          meta on ONE row; once the chat is scrolled it collapses to a compact
          single row. It's a normal flex item (NOT sticky), so collapsing just
          resizes the content below — the message list never jumps. ✎ and New
          live in a fixed top-right cluster, independent of the title length. */}
      <div style={{ padding: headerCondensed ? "8px 18px" : "14px 18px", display: "flex", alignItems: "flex-start", gap: 12, borderBottom: `1px solid ${COLORS.border}`, background: COLORS.card, flexShrink: 0, transition: "padding 0.15s ease" }}>
        <div style={{ flexShrink: 0 }}><LyraAvatar size={headerCondensed ? 28 : 36} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingTitle ? (
            <input
              ref={titleInputRef}
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={finishEditingTitle}
              onKeyDown={e => { if (e.key === "Enter") finishEditingTitle(); if (e.key === "Escape") { setEditingTitle(false); } }}
              style={{ width: "100%", fontFamily: "'Courier Prime', monospace", fontSize: 14, fontWeight: 700, color: COLORS.heading, border: `1.5px solid ${COLORS.heading}`, background: COLORS.bg2, padding: "4px 8px", borderRadius: 8, outline: "none", boxSizing: "border-box" }}
            />
          ) : (
            <>
              {/* Title — clamped to 2 lines at rest (1 when condensed). Tapping
                  it toggles the FULL question (Unit 5); rename is the separate
                  ✎ control, so there is one unambiguous gesture per target. */}
              <div
                onClick={headerCondensed ? undefined : () => setTitleExpanded(v => !v)}
                title={headerCondensed ? undefined : (titleExpanded ? "Tap to shorten" : "Tap to show the full title")}
                style={{
                  fontFamily: "'Courier Prime', monospace", fontSize: 14, fontWeight: 700, color: COLORS.heading,
                  lineHeight: 1.3, wordBreak: "break-word", cursor: headerCondensed ? "default" : "pointer",
                  ...((headerCondensed || !titleExpanded) && {
                    display: "-webkit-box", WebkitBoxOrient: "vertical",
                    WebkitLineClamp: headerCondensed ? 1 : 2, overflow: "hidden",
                  }),
                }}
              >{title}</div>
              {headerCondensed ? (
                <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {typeLabel} · {apiCalls} calls
                </div>
              ) : (
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2, position: "relative" }}>
                  {/* ONE non-wrapping row (Unit 2) — ellipsis, never a mid-token
                      wrap. Ordered so truncation drops the lowest priority
                      first: type > API calls > word count. */}
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <button
                      onClick={() => setShowTypePicker(v => !v)}
                      title="Change writing type"
                      style={{ background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 11, color: COLORS.muted, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 2 }}
                    >
                      {typeLabel}
                    </button>
                    {purpose && purpose !== "personal" ? ` · ${purpose.toUpperCase()}` : ""} · {apiCalls} calls · {wcLabel} words
                  </div>
                  {showTypePicker && (
                    <div onClick={() => setShowTypePicker(false)} style={{ position: "fixed", inset: 0, zIndex: 89 }} />
                  )}
                  {showTypePicker && (
                    <div onMouseLeave={() => setHoverTypeId(null)} style={{ position: "absolute", top: 18, left: 0, zIndex: 90, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 6, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", gap: 2, minWidth: 180 }}>
                      {writingTypes.map(wt => {
                        // The highlight FOLLOWS the pointer (classic menu behaviour);
                        // with no pointer inside, it rests on the current type. Bold
                        // always marks the current type.
                        const highlighted = hoverTypeId ? wt.id === hoverTypeId : wt.id === type;
                        return (
                          <button
                            key={wt.id}
                            onClick={() => switchWritingType(wt.id)}
                            onMouseEnter={() => setHoverTypeId(wt.id)}
                            style={{ textAlign: "left", fontSize: 12, fontFamily: "'Courier Prime', monospace", padding: "6px 10px", borderRadius: 8, border: "none", background: highlighted ? COLORS.bg3 : "transparent", color: COLORS.heading, fontWeight: wt.id === type ? 700 : 400, cursor: "pointer", transition: "background 0.1s" }}
                          >
                            {wt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {/* Top-right control cluster — fixed position, independent of the
            title's line count and the collapse state (Unit 4). */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {!editingTitle && (
            <button
              onClick={startEditingTitle}
              title="Edit title"
              style={{ width: 30, height: 30, borderRadius: 15, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12, color: COLORS.muted, flexShrink: 0, transition: "all 0.2s" }}
            >✎</button>
          )}
          <button onClick={() => { autoSave(); resetToNew(); }} style={{ padding: "6px 14px", borderRadius: 16, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 12, cursor: "pointer", color: COLORS.muted, flexShrink: 0 }}>New</button>
        </div>
      </div>

      {/* Top Navigation (was bottom — thumb-reach put it under the keyboard
          and the user wants the mode switch visible up top) */}
      <div style={{ padding: "8px 18px 10px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ width: 36, height: 36, borderRadius: 18, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: COLORS.muted }}>☰</button>

        <div style={{ display: "flex", background: COLORS.bg3, borderRadius: 20, padding: 3, position: "relative" }}>
          {["chat", "preview"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 16px", borderRadius: 17, border: "none", background: tab === t ? COLORS.card : "transparent", fontFamily: "'Courier Prime', monospace", fontSize: 13, color: tab === t ? COLORS.heading : COLORS.muted, fontWeight: tab === t ? 700 : 400, cursor: "pointer", position: "relative", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.06)" : "none", transition: "all 0.2s" }}>
              {t === "chat" ? "Chat" : "My Writing"}
              {t === "preview" && draft.trim() && tab !== "preview" && (
                <div style={{ position: "absolute", top: 5, right: 8, width: 7, height: 7, borderRadius: "50%", background: COLORS.blue }} />
              )}
            </button>
          ))}
        </div>

        <button onClick={() => setShowGrammarLog(true)} style={{ width: 36, height: 36, borderRadius: 18, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: COLORS.muted, letterSpacing: 2, position: "relative" }}>
          ···
          {grammarLog.length > 0 && (
            <div style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: 8, background: checkFlash ? COLORS.green : COLORS.red, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.3s" }}>{grammarLog.length > 99 ? "99" : grammarLog.length}</div>
          )}
        </button>
      </div>

      {/* Genre-mismatch banner: explicit format cue in the topic contradicts
          the declared type. Dismiss persists per writing (genreCueDecision).
          §43: defers to the generated greeting when that raised the cue
          (welcomeHandledCue) — only the genre-blind template fallback leaves
          this banner as the safety net. */}
      {(() => {
        if (genreCueDecision || welcomeHandledCue) return null;
        const cue = detectFormatCue(topic);
        if (!cue || !type || cue.typeId === type) return null;
        const mappedLabel = typeLabelOf(cue.typeId);
        return (
          <div style={{ margin: "8px 16px 0", padding: "10px 14px", borderRadius: 12, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.amber}`, background: "#FFF8EE", fontFamily: "'Courier Prime', monospace", flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.55 }}>
              Your question asks for a <strong>{cue.cueLabel}</strong>, but we're set up for <strong>{typeLabel}</strong>. The examiner looks for different things.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={() => switchWritingType(cue.typeId)}
                style={{ fontSize: 11, fontFamily: "'Courier Prime', monospace", padding: "5px 12px", borderRadius: 8, border: "none", background: COLORS.amber, color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                Switch to {mappedLabel}
              </button>
              <button
                onClick={() => setGenreCueDecision("kept:" + type)}
                style={{ fontSize: 11, fontFamily: "'Courier Prime', monospace", padding: "5px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, cursor: "pointer" }}
              >
                Keep {typeLabel}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Content Area */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "chat" ? (
          <ChatTab
            messages={messages} setMessages={setMessages}
            typingMsg={typingMsg} setTypingMsg={setTypingMsg}
            chatLoading={chatLoading} sendChat={sendChat} stopChat={stopChat}
            handleTypewriterDone={handleTypewriterDone}
            reloadChat={reloadChat} translateText={translateText}
            typeLabel={typeLabel}
            topic={topic} draft={draft} currentWords={currentWords}
            addToDraft={addToDraft}
            onScrollChange={(st) => setHeaderCollapsed(c => nextHeaderCollapsed(st, c))}
            onSaveAchievement={(lyraText, studentSentence) => {
              // Backstop for when the AI forgets the hidden LYRA_LEARNING_DATA
              // block: save the student's sentence + Lyra's verbatim reply as a
              // freeform Masterclass Report card. Try to lift the polished
              // sentence out of an "After:" line in Lyra's report if present,
              // else fall back to the student's most recent message.
              const afterMatch = lyraText.match(/After:\s*([^\n]+)/i);
              const after = (afterMatch ? afterMatch[1].trim().replace(/^["“]|["”]$/g, "") : studentSentence || "").trim();
              const techMatch = lyraText.match(/(?:You used|deployed|technique)\s+(?:the\s+)?["'“]?([A-Z][\w '\-]{2,40})["'”]?/);
              saveMasterclassReport({
                source: "manual",
                topic: topic?.slice(0, 80) || "",
                after,
                technique: techMatch ? techMatch[1].trim() : "",
                reportText: lyraText,
              });
            }}
            onSaveCorrections={(fixes) => {
              // §70: save the grammar fixes parsed from a chat critique into the
              // Grammar Log (the hidden LYRA_LEARNING_DATA auto-sync is unreliable on
              // a long sweep). Same entry shape + phrase|correction dedup as the
              // proofread / coaching sync so a re-tap or a re-mark can't duplicate.
              if (!fixes?.length) return;
              const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
              const newEntries = fixes.map(f => ({
                id: Date.now() + "_" + Math.random().toString(36).slice(2, 6),
                date,
                rule: f.rule || "Grammar fix",
                phrase: f.phrase,
                correction: f.correction,
                explanation: f.explanation || "",
                example_wrong: "",
                example_correct: "",
                // §73: store the writing's id (the "From:" line resolves its full title
                // live, collapsed at display) + a topic snippet as a fallback label.
                writingId: activeWritingId,
                topic: (topic || "Untitled").slice(0, 200),
                source: "coaching",
              }));
              // Dedup against the CURRENT log (phrase|correction) up front so the
              // success flash only fires when something genuinely NEW is saved — a
              // §69 re-mark re-enables the button on the new message, and re-tapping
              // it must not flash "saved!" for a no-op.
              const seen = new Set(grammarLog.map(e => `${(e.phrase || "").toLowerCase()}|${(e.correction || "").toLowerCase()}`));
              const fresh = newEntries.filter(e => !seen.has(`${e.phrase.toLowerCase()}|${e.correction.toLowerCase()}`));
              if (!fresh.length) return;
              setGrammarLog(prev => {
                const seenP = new Set(prev.map(e => `${(e.phrase || "").toLowerCase()}|${(e.correction || "").toLowerCase()}`));
                const reallyFresh = fresh.filter(e => !seenP.has(`${e.phrase.toLowerCase()}|${e.correction.toLowerCase()}`));
                return [...reallyFresh, ...prev];
              });
              setCheckFlash(true);
              setTimeout(() => setCheckFlash(false), 2000);
            }}
            onHelpMeStart={() => sendChat("I'm stuck and don't know how to start. Help me begin writing.", false, true)}
            onDeploySkills={() => {
              let saved = [];
              try { saved = JSON.parse(localStorage.getItem("lyra-style-skills") || "[]"); } catch (e) {}
              if (saved.length === 0) { setShowStyleLab(true); return; }
              // ANTI-BIAS: Anonymise skill names before sending to AI for recommendation
              const { anonymised, mapping } = anonymiseSkillsForAI(saved);
              const skillsSummary = anonymised.map((sk, i) => {
                const techs = sk.analysedTechniques || sk.researchedTechniques || (sk.techniques || []).map(t => typeof t === 'string' ? { technique: t } : t);
                const techList = techs.map(t => t.technique).join(", ");
                return `${i + 1}. ${sk.authorName}${sk.signatureStyle ? ` — ${sk.signatureStyle}` : ""}\n   Techniques: ${techList}`;
              }).join("\n");
              sendChat(`I have these writing skills saved:\n${skillsSummary}\n\nLook at my current draft and tell me which of these skills I should deploy right now. For each one you recommend, explain exactly how it solves a specific problem in my writing or helps me improve a specific part of my ${typeLabel.toLowerCase()}.`);
            }}
          />
        ) : (
          <EditorTab
            draft={draft} setDraft={setDraft}
            wordCount={wordCount} currentWords={currentWords}
            progress={progress} goalReached={goalReached} wcLabel={wcLabel}
            suggestions={suggestions} setSuggestions={setSuggestions}
            sugBadge={sugBadge} setSugBadge={setSugBadge}
            applySuggestion={applySuggestion}
            proofread={proofread} setProofread={setProofread}
            proofTab={proofTab} setProofTab={setProofTab}
            proofLoading={proofLoading} runProofread={runProofread} cancelProofread={cancelProofread}
            checkFlash={checkFlash}
            miniLesson={miniLesson} fetchMiniLesson={fetchMiniLesson}
            sendChat={sendChat} setTab={setTab}
            writingTechniques={writingTechniques}
            appliedSkill={appliedSkill}
            setWritingTechniques={setWritingTechniques}
            techsEnriching={techsEnriching}
            onApplySkill={applySkillWithEnrichment}
            pendingSkillsOpen={pendingSkillsOpen}
            setPendingSkillsOpen={setPendingSkillsOpen}
            onOpenTraining={openTrainingSession}
          />
        )}
      </div>

      {/* Sidebar */}
      <Sidebar {...sidebarProps} />

      {/* Grammar Log Overlay */}
      <GrammarLog
        grammarLog={grammarLog} setGrammarLog={setGrammarLog}
        showGrammarLog={showGrammarLog} setShowGrammarLog={setShowGrammarLog}
        miniLesson={miniLesson} fetchMiniLesson={fetchMiniLesson}
        sendChat={sendChat} setTab={setTab}
        currentTopic={topic} currentTitle={title} currentWritingId={activeWritingId}
      />

      {/* Style Lab Overlay */}
      <StyleLab showStyleLab={showStyleLab} setShowStyleLab={setShowStyleLab} setSidebarOpen={setSidebarOpen} projects={projects} trackCall={trackCall} setAppliedSkill={setAppliedSkill} setWritingTechniques={setWritingTechniques} initialTab={styleLabInitialTab} onOpenTraining={openTrainingSession} writingType={type} />
        <WordLookup trackCall={trackCall} />

      {/* Training Session Overlay */}
      {trainingSkill && <TrainingSession skill={trainingSkill} startTechIdx={trainingStartTech} onClose={closeTrainingSession} trackCall={trackCall} />}

    </div>
  );
}
