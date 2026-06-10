import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS, FONTS_LINK, writingTypes, getExamRules } from "./constants.js";
import { keyframes, sharedStyles as s } from "./styles.js";
import { callAI } from "./api.js";
import { getRouteConfig } from "./ai-router.js";
import { buildCoachPrompt, buildScaffoldingPrompt, buildStructuralPrompt, buildProofreadPrompt } from "./prompts.js";
import { parseTechniques, anonymiseSkillsForAI, restoreAuthorNames, ANTI_BIAS_BLOCK } from "./utils.js";
import { extractLearningData, syncLearningData, saveMasterclassReport, maybeSaveVisibleReport } from "./learning-sync.js";
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
import { generateTitle } from "./titleGenerator.js";

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

  // Editor
  const [title, setTitle] = useState("Untitled");
  const [editingTitle, setEditingTitle] = useState(false);
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

  // Welcome
  const typedWelcome = useRef(false);
  const [welcomeText, setWelcomeText] = useState("");

  // Derived values
  const typeLabel = type ? writingTypes.find(w => w.id === type)?.label : "";
  const examRules = getExamRules(purpose, type);
  const wcLabel = wordCount === "600+" ? "600+" : wordCount;
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
        ...w, title, draft, messages, topic, type, wordCount, purpose, updatedAt: new Date().toISOString(),
      } : w)
    })));
  }, [activeWritingId, title, draft, messages, topic, type, wordCount, purpose, screen]);

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
      id, title: overrideTitle || title, topic, type, wordCount, purpose, draft, messages,
      sourceText: sourceText || undefined,
      sourceAnalysis: sourceAnalysis || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, writings: [writing, ...p.writings] } : p));
    setActiveWritingId(id);
    return id;
  }, [title, topic, type, wordCount, purpose, draft, messages, sourceText, sourceAnalysis]);

  const loadWriting = useCallback((writing) => {
    setTopic(writing.topic || "");
    setType(writing.type || null);
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
    typedWelcome.current = true;
    setWelcomeText("");
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
    setWordCount(null);
    setMessages([]);
    setDraft("");
    setTitle("Untitled");
    typedWelcome.current = false;
    setWelcomeText("");
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
  useEffect(() => {
    if (screen === "app" && !typedWelcome.current) {
      typedWelcome.current = true;
      setTimeout(() => {
        const nameGreeting = userName ? `Hey ${userName}! ` : "Hello! ";
        const sourceNote = sourceAnalysis && appliedSkill ? `\n\nYou studied ${appliedSkill.authorName}'s writing and extracted ${extractedSkills?.length || "several"} techniques — I'll ground my coaching in those techniques as we work.` : "";
        const skillNote = !sourceAnalysis && appliedSkill ? `\n\nI see you've been studying ${appliedSkill.authorName}'s style — great choice for this piece! I'll weave in their techniques as we work.` : "";
        const techNote = !sourceAnalysis && writingTechniques?.length ? `\n\nI've researched ${writingTechniques.length} writing techniques for your ${typeLabel.toLowerCase()} — check the ✦ Tips button in the editor to review them anytime.` : "";
        const examNote = purpose && purpose !== "personal" && purpose !== "school" ? `\n\nI'm following ${purpose.toUpperCase()} exam conventions — my suggestions will respect the marking criteria.` : "";
        const msg = `${nameGreeting}I'm Lyra, your writing coach. You're working on a ${typeLabel.toLowerCase()} about "${topic}" — aiming for ${wcLabel} words. I'll guide you through every step, but remember: every word will be yours.${sourceNote}${skillNote}${techNote}${examNote}\n\nLet's start! Would you like me to outline the structure for your ${typeLabel.toLowerCase()}, or do you want to brainstorm ideas first?`;
        setWelcomeText(msg);
      }, 100);
    }
  }, [screen]);

  // Finalize typewriter when switching away from chat tab
  // Prevents the animation restarting from scratch when switching back
  useEffect(() => {
    if (tab !== "chat" && typingMsg) {
      const entry = { role: "ai", text: typingMsg.text };
      if (Array.isArray(typingMsg.sources) && typingMsg.sources.length) entry.sources = typingMsg.sources;
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
  }, [draft, appliedSkill]);

  const sendChat = useCallback(async (text, useSearch = false, scaffolding = false) => {
    if (!text.trim()) return;
    const userMsg = { role: "user", text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    setTypingMsg(null);

    // Create abort controller for this request
    const abortCtrl = new AbortController();
    chatAbortRef.current = abortCtrl;

    try {
      // Build conversation history with roles so Lyra knows who said what
      const allMsgs = [];
      if (welcomeText) allMsgs.push({ role: "ai", text: welcomeText });
      allMsgs.push(...messages);
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
      const fullMsg = `${history}Student says: ${text.trim()}${ctx}${skillCtx}${techCtx}${allSkillsCtx}`;
      const chatRoute = getRouteConfig(scaffolding ? "scaffolding" : "chat_coaching");
      trackCall();
      // Build source context for prompt grounding (if source text was analysed)
      const sourceCtxObj = sourceAnalysis && appliedSkill ? {
        authorName: appliedSkill.authorName || "Unknown",
        targetVoice: targetVoice || appliedSkill.signatureStyle || "",
        techniqueCount: extractedSkills?.length || appliedSkill.analysedTechniques?.length || 0,
      } : null;
      const baseSysPrompt = scaffolding ? buildScaffoldingPrompt(topic, typeLabel, wcLabel, examRules, sourceCtxObj) : buildCoachPrompt(topic, typeLabel, wcLabel, examRules, sourceCtxObj);
      const sysPrompt = antiBiasPrefix ? baseSysPrompt + antiBiasPrefix : baseSysPrompt;
      let result = await callAI(sysPrompt, fullMsg, useSearch, 4096, chatRoute.thinkingBudget, undefined, abortCtrl.signal, chatRoute.model);

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
      setTypingMsg({ role: "ai", text: displayText, sources, id: Date.now() });
    } catch (e) {
      setChatLoading(false);
      chatAbortRef.current = null;
      // Only show error if it wasn't a user-initiated abort
      if (e.name !== "AbortError") {
        setMessages(prev => [...prev, { role: "ai", text: "I'm having trouble connecting. Please try again." }]);
      }
    }
  }, [messages, welcomeText, draft, topic, typeLabel, wcLabel, currentWords, appliedSkill, writingTechniques, examRules, sourceAnalysis, extractedSkills, targetVoice]);

  const stopChat = useCallback(() => {
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
      chatAbortRef.current = null;
    }
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
    // Carry sources (web-search grounding attributions) from typingMsg
    // into the saved message so they persist on re-render / reload.
    const entry = { role: "ai", text: msg.text };
    if (Array.isArray(msg.sources) && msg.sources.length) entry.sources = msg.sources;
    setMessages(prev => [...prev, entry]);
    setTypingMsg(null);
  }, []);

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
    try {
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
      trackCall();
      const result = await callAI(buildProofreadPrompt(topic, typeLabel, appliedSuggestions, activeSkillCtx, examRules), draft, false, 1000, proofRoute.thinkingBudget, undefined, undefined, proofRoute.model);
      const parsed = JSON.parse(result.replace(/```json|```/g, "").trim());
      setProofread(parsed);
      setProofTab("grammar");
      if (parsed.grammar?.length) {
        const newEntries = parsed.grammar.map(g => ({
          id: Date.now() + "_" + Math.random().toString(36).slice(2, 6),
          date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
          phrase: g.phrase,
          correction: g.correction,
          rule: g.rule,
          explanation: g.explanation,
          example_wrong: g.example_wrong || "",
          example_correct: g.example_correct || "",
          topic: topic?.slice(0, 60) || "Untitled",
        }));
        setGrammarLog(prev => [...newEntries, ...prev]);
        setCheckFlash(true);
        setTimeout(() => setCheckFlash(false), 2000);
      }
    } catch (e) {
      setProofread({ grammar: [], style: [], vocabulary: [], strengths: "Unable to analyse.", nextFocus: "Try again." });
    }
    setProofLoading(false);
  }, [draft, topic, typeLabel, appliedSuggestions, appliedSkill, examRules]);

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
        <StyleLab showStyleLab={showStyleLab} setShowStyleLab={setShowStyleLab} trackCall={trackCall} setAppliedSkill={setAppliedSkill} setWritingTechniques={setWritingTechniques} onApplySkill={applySkillWithEnrichment} initialTab={styleLabInitialTab} onOpenTraining={openTrainingSession} writingType={type} />
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
        <StyleLab showStyleLab={showStyleLab} setShowStyleLab={setShowStyleLab} trackCall={trackCall} setAppliedSkill={setAppliedSkill} setWritingTechniques={setWritingTechniques} onApplySkill={applySkillWithEnrichment} initialTab={styleLabInitialTab} onOpenTraining={openTrainingSession} writingType={type} />
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

      {/* Header */}
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12, borderBottom: `1px solid ${COLORS.border}`, background: COLORS.card, flexShrink: 0 }}>
        <LyraAvatar size={36} />
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
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
              <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 14, fontWeight: 700, color: COLORS.heading, lineHeight: 1.3, wordBreak: "break-word", flex: 1, minWidth: 0 }}>{title}</div>
              <button
                onClick={startEditingTitle}
                title="Edit title"
                style={{ width: 24, height: 24, borderRadius: 12, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, color: COLORS.muted, flexShrink: 0, marginTop: 1, transition: "all 0.2s" }}
              >✎</button>
            </div>
          )}
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{typeLabel}{purpose && purpose !== "personal" ? ` · ${purpose.toUpperCase()}` : ""} · {wcLabel} words · {apiCalls} API calls</div>
        </div>
        <button onClick={() => { autoSave(); resetToNew(); }} style={{ padding: "6px 14px", borderRadius: 16, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 12, cursor: "pointer", color: COLORS.muted, marginTop: 2 }}>New</button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "chat" ? (
          <ChatTab
            messages={messages} setMessages={setMessages}
            typingMsg={typingMsg} setTypingMsg={setTypingMsg}
            chatLoading={chatLoading} sendChat={sendChat} stopChat={stopChat}
            handleTypewriterDone={handleTypewriterDone}
            welcomeText={welcomeText} typeLabel={typeLabel}
            topic={topic} draft={draft} currentWords={currentWords}
            addToDraft={addToDraft}
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
            proofLoading={proofLoading} runProofread={runProofread}
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
      />

      {/* Style Lab Overlay */}
      <StyleLab showStyleLab={showStyleLab} setShowStyleLab={setShowStyleLab} trackCall={trackCall} setAppliedSkill={setAppliedSkill} setWritingTechniques={setWritingTechniques} onApplySkill={applySkillWithEnrichment} initialTab={styleLabInitialTab} onOpenTraining={openTrainingSession} writingType={type} />
        <WordLookup trackCall={trackCall} />

      {/* Training Session Overlay */}
      {trainingSkill && <TrainingSession skill={trainingSkill} startTechIdx={trainingStartTech} onClose={closeTrainingSession} trackCall={trackCall} />}

      {/* Bottom Navigation */}
      <div style={{ padding: "10px 18px 16px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
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
    </div>
  );
}
