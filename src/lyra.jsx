import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS, FONTS_LINK, writingTypes } from "./constants.js";
import { keyframes, sharedStyles as s } from "./styles.js";
import { callAI } from "./api.js";
import { buildCoachPrompt, ghostPrompt, buildStructuralPrompt, buildProofreadPrompt } from "./prompts.js";
import { LyraAvatar } from "./components/Icons.jsx";
import Onboarding from "./components/Onboarding.jsx";
import ChatTab from "./components/ChatTab.jsx";
import EditorTab from "./components/EditorTab.jsx";
import GrammarLog from "./components/GrammarLog.jsx";
import StyleLab from "./components/StyleLab.jsx";
import Sidebar from "./components/Sidebar.jsx";
import { generateTitle } from "./titleGenerator.js";

export default function Lyra() {
  // Core state
  const [screen, setScreen] = useState("onboarding");
  const [userName, setUserName] = useState("");
  const [userNameLoaded, setUserNameLoaded] = useState(false);
  const [topic, setTopic] = useState("");
  const [type, setType] = useState(null);
  const [wordCount, setWordCount] = useState(null);
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

  // Editor
  const [title, setTitle] = useState("Untitled");
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [ghostText, setGhostText] = useState("");
  const [ghostLoading, setGhostLoading] = useState(false);
  const ghostTimer = useRef(null);
  const [cursorPos, setCursorPos] = useState(0);

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

  const autoSave = useCallback(() => {
    if (!activeWritingId || !draft.trim() || screen !== "app") return;
    setProjects(prev => prev.map(p => ({
      ...p,
      writings: p.writings.map(w => w.id === activeWritingId ? {
        ...w, title, draft, messages, topic, type, wordCount, updatedAt: new Date().toISOString(),
      } : w)
    })));
  }, [activeWritingId, title, draft, messages, topic, type, wordCount, screen]);

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
      id, title: overrideTitle || title, topic, type, wordCount, draft, messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, writings: [writing, ...p.writings] } : p));
    setActiveWritingId(id);
    return id;
  }, [title, topic, type, wordCount, draft, messages]);

  const loadWriting = useCallback((writing) => {
    setTopic(writing.topic || "");
    setType(writing.type || null);
    setWordCount(writing.wordCount || null);
    setTitle(writing.title || "Untitled");
    setDraft(writing.draft || "");
    setMessages(writing.messages || []);
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

  const resetToNew = useCallback(() => {
    setSidebarOpen(false);
    setScreen("onboarding");
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
    setApiCalls(0);
    apiCallRef.current = 0;
    setActiveWritingId(null);
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
        `The student made this mistake: "${entry.phrase}" → "${entry.correction}"\nThe grammar rule is: ${entry.rule}\nTheir explanation was: ${entry.explanation}`
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
        const msg = `${nameGreeting}I'm Lyra, your writing coach. You're working on a ${typeLabel.toLowerCase()} about "${topic}" — aiming for ${wcLabel} words. I'll guide you through every step, but remember: every word will be yours.\n\nLet's start! Would you like me to outline the structure for your ${typeLabel.toLowerCase()}, or do you want to brainstorm ideas first?`;
        setWelcomeText(msg);
      }, 100);
    }
  }, [screen]);

  // Ghost text trigger
  useEffect(() => {
    if (ghostTimer.current) clearTimeout(ghostTimer.current);
    setGhostText("");
    if (!draft || draft.length < 15) return;
    const lastChar = draft[draft.length - 1];
    if (lastChar !== " " && lastChar !== ",") return;
    ghostTimer.current = setTimeout(async () => {
      setGhostLoading(true);
      try {
        const last100 = draft.slice(-200);
        trackCall();
        const result = await callAI(ghostPrompt, `Continue this text naturally: "${last100}"`);
        if (result && result.length < 80) setGhostText(result.trim());
      } catch (e) { /* silent */ }
      setGhostLoading(false);
    }, 950);
    return () => clearTimeout(ghostTimer.current);
  }, [draft]);

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
        trackCall();
        const result = await callAI(buildStructuralPrompt(topic, typeLabel), lastPara);
        const parsed = JSON.parse(result.replace(/```json|```/g, "").trim());
        if (parsed.suggestions?.length) {
          setSuggestions(parsed.suggestions);
          setSugBadge(true);
          lastAnalysed.current = lastPara;
        }
      } catch (e) { /* silent */ }
    }, 2500);
    return () => clearTimeout(sugTimer.current);
  }, [draft]);

  const sendChat = useCallback(async (text, useSearch = false) => {
    if (!text.trim()) return;
    const userMsg = { role: "user", text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    setTypingMsg(null);
    try {
      const history = messages.map(m => m.text).join("\n");
      const ctx = draft ? `\n\n[Student's current draft (${currentWords} words):\n${draft.slice(0, 500)}${draft.length > 500 ? "..." : ""}]` : "";
      const fullMsg = `${history ? "Previous conversation context:\n" + history + "\n\n" : ""}Student says: ${text.trim()}${ctx}`;
      trackCall();
      const result = await callAI(buildCoachPrompt(topic, typeLabel, wcLabel), fullMsg, useSearch);
      setChatLoading(false);
      setTypingMsg({ role: "ai", text: result, id: Date.now() });
    } catch (e) {
      setChatLoading(false);
      setMessages(prev => [...prev, { role: "ai", text: "I'm having trouble connecting. Please try again." }]);
    }
  }, [messages, draft, topic, typeLabel, wcLabel, currentWords]);

  const handleTypewriterDone = useCallback((msg) => {
    setMessages(prev => [...prev, { role: "ai", text: msg.text }]);
    setTypingMsg(null);
  }, []);

  const runProofread = useCallback(async () => {
    if (!draft.trim()) return;
    setProofLoading(true);
    setProofread(null);
    try {
      trackCall();
      const result = await callAI(buildProofreadPrompt(topic, typeLabel, appliedSuggestions), draft);
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
  }, [draft, topic, typeLabel, appliedSuggestions]);

  const acceptGhost = useCallback(() => {
    if (!ghostText) return;
    const before = draft.slice(0, cursorPos);
    const after = draft.slice(cursorPos);
    setDraft(before + ghostText + " " + after);
    setGhostText("");
    setCursorPos(cursorPos + ghostText.length + 1);
  }, [ghostText, draft, cursorPos]);

  const applySuggestion = useCallback((sug) => {
    if (sug.original && sug.improved) {
      setDraft(prev => prev.replace(sug.original, sug.improved));
      setAppliedSuggestions(prev => [...prev, { technique: sug.technique, original: sug.original, improved: sug.improved }]);
      setSuggestions(null);
    }
  }, []);

  // === SIDEBAR PROPS ===

  const sidebarProps = {
    sidebarOpen, setSidebarOpen, projects, setProjects, activeWritingId,
    expandedProjects, setExpandedProjects, editingProjectId, setEditingProjectId,
    editingProjectName, setEditingProjectName, createProject, renameProject,
    deleteProject, moveWriting, deleteWriting, loadWriting,
    onNewWriting: resetToNew, grammarLog, setShowStyleLab,
  };

  // === ONBOARDING SCREEN ===

  if (screen === "onboarding") {
    return (
      <>
        <Onboarding
          userName={userName} setUserName={setUserName}
          topic={topic} setTopic={setTopic}
          type={type} setType={setType}
          wordCount={wordCount} setWordCount={setWordCount}
          onStart={() => { const autoTitle = generateTitle(topic, type); setTitle(autoTitle); setScreen("app"); setTimeout(() => saveNewWriting("default", autoTitle), 500); }}
          sidebarProps={sidebarProps}
        />
        <StyleLab showStyleLab={showStyleLab} setShowStyleLab={setShowStyleLab} trackCall={trackCall} />
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
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{typeLabel} · {wcLabel} words · {apiCalls} API calls</div>
        </div>
        <button onClick={() => { autoSave(); resetToNew(); }} style={{ padding: "6px 14px", borderRadius: 16, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 12, cursor: "pointer", color: COLORS.muted, marginTop: 2 }}>New</button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "chat" ? (
          <ChatTab
            messages={messages} setMessages={setMessages}
            typingMsg={typingMsg} setTypingMsg={setTypingMsg}
            chatLoading={chatLoading} sendChat={sendChat}
            handleTypewriterDone={handleTypewriterDone}
            welcomeText={welcomeText} typeLabel={typeLabel}
            topic={topic} draft={draft}
          />
        ) : (
          <EditorTab
            draft={draft} setDraft={setDraft}
            wordCount={wordCount} currentWords={currentWords}
            progress={progress} goalReached={goalReached} wcLabel={wcLabel}
            ghostText={ghostText} setGhostText={setGhostText} acceptGhost={acceptGhost}
            suggestions={suggestions} setSuggestions={setSuggestions}
            sugBadge={sugBadge} setSugBadge={setSugBadge}
            applySuggestion={applySuggestion}
            proofread={proofread} setProofread={setProofread}
            proofTab={proofTab} setProofTab={setProofTab}
            proofLoading={proofLoading} runProofread={runProofread}
            checkFlash={checkFlash}
            miniLesson={miniLesson} fetchMiniLesson={fetchMiniLesson}
            sendChat={sendChat} setTab={setTab}
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
      <StyleLab showStyleLab={showStyleLab} setShowStyleLab={setShowStyleLab} trackCall={trackCall} />

      {/* Bottom Navigation */}
      <div style={{ padding: "10px 18px 16px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ width: 36, height: 36, borderRadius: 18, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: COLORS.muted }}>☰</button>

        <div style={{ display: "flex", background: COLORS.bg3, borderRadius: 20, padding: 3, position: "relative" }}>
          {["chat", "preview"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "7px 22px", borderRadius: 17, border: "none", background: tab === t ? COLORS.card : "transparent", fontFamily: "'Courier Prime', monospace", fontSize: 13, color: tab === t ? COLORS.heading : COLORS.muted, fontWeight: tab === t ? 700 : 400, cursor: "pointer", position: "relative", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.06)" : "none", transition: "all 0.2s" }}>
              {t === "chat" ? "Chat" : "Preview"}
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
