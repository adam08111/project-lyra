import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS } from "../constants.js";
import { sharedStyles as s } from "../styles.js";
import { callAI } from "../api.js";
import { styleProfilerPrompt, styleCoachPrompt } from "../prompts.js";
import { FeatherIcon } from "./Icons.jsx";
import { useTypewriter } from "../hooks.js";

function PracticeTypingBubble({ msg, onDone }) {
  const { displayed, done } = useTypewriter(msg.text, 14);
  const calledDone = useRef(false);
  useEffect(() => {
    if (done && !calledDone.current) {
      calledDone.current = true;
      onDone(msg);
    }
  }, [done, msg, onDone]);
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, animation: "fadeUp 0.25s ease" }}>
      <div style={{ marginTop: 4 }}><FeatherIcon size={16} /></div>
      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", fontSize: 13, lineHeight: 1.7, maxWidth: "85%", whiteSpace: "pre-wrap" }}>
        {displayed}{!done && <span style={{ animation: "blink 0.8s infinite", color: COLORS.accent1 }}>|</span>}
      </div>
    </div>
  );
}

function parseProfileSections(text) {
  const sections = [];
  const lines = text.split("\n");
  let currentTitle = null;
  let currentContent = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match section headers: all-caps lines that are known sections
    const sectionHeaders = ["FIGURATIVE LANGUAGE", "SENTENCE ARCHITECTURE", "PHRASAL MECHANICS", "VERBALS AND MODIFIERS", "ADVANCED GRAMMAR AND SYNTAX", "DICTION AND LEXICON", "RHETORICAL DEVICES", "TONE AND VOICE"];
    const isHeader = sectionHeaders.some(h => trimmed === h);
    const isAuthor = trimmed.startsWith("AUTHOR:");

    if (isAuthor) {
      // Don't create a section card for AUTHOR — it's extracted separately
      continue;
    }

    if (isHeader) {
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
      }
      currentTitle = trimmed;
      currentContent = [];
    } else if (currentTitle) {
      currentContent.push(line);
    }
  }
  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
  }
  return sections;
}

function extractAuthor(text) {
  const match = text.match(/^AUTHOR:\s*(.+)$/m);
  return match ? match[1].trim() : "Unknown Author";
}

export default function StyleLab({ showStyleLab, setShowStyleLab, trackCall }) {
  const [activeTab, setActiveTab] = useState("analyze");
  const [referenceText, setReferenceText] = useState("");
  const [styleProfile, setStyleProfile] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [profileSections, setProfileSections] = useState([]);
  const [error, setError] = useState("");

  const [practiceMessages, setPracticeMessages] = useState([]);
  const [practiceInput, setPracticeInput] = useState("");
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [typingMsg, setTypingMsg] = useState(null);

  const practiceEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (practiceEndRef.current) {
      practiceEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [practiceMessages, typingMsg]);

  const wordCount = referenceText.trim() ? referenceText.trim().split(/\s+/).length : 0;

  const resetAll = useCallback(() => {
    setReferenceText("");
    setStyleProfile("");
    setAnalyzing(false);
    setAuthorName("");
    setProfileSections([]);
    setError("");
    setPracticeMessages([]);
    setPracticeInput("");
    setTypingMsg(null);
    setActiveTab("analyze");
  }, []);

  const analyzeStyle = useCallback(async () => {
    if (!referenceText.trim() || referenceText.trim().split(/\s+/).length < 30) return;
    setAnalyzing(true);
    setError("");
    try {
      trackCall();
      const result = await callAI(styleProfilerPrompt, referenceText, false, 3000);
      if (!result || !result.trim()) {
        setError("No response received. Please check your API connection and try again.");
      } else {
        setStyleProfile(result);
        setAuthorName(extractAuthor(result));
        const sections = parseProfileSections(result);
        if (sections.length === 0) {
          // Profile came back but wasn't structured as expected — show raw
          setProfileSections([{ title: "STYLE ANALYSIS", content: result }]);
        } else {
          setProfileSections(sections);
        }
      }
    } catch (e) {
      console.error("Style Lab analysis error:", e);
      setError(e.message || "Analysis failed. Please try again.");
    }
    setAnalyzing(false);
  }, [referenceText, trackCall]);

  const sendPractice = useCallback(async (text) => {
    if (!text.trim() || !styleProfile) return;
    const userMsg = { role: "user", text: text.trim() };
    setPracticeMessages(prev => [...prev, userMsg]);
    setPracticeInput("");
    setPracticeLoading(true);
    setTypingMsg(null);
    try {
      trackCall();
      const result = await callAI(styleCoachPrompt(styleProfile, authorName), text.trim(), false, 2000);
      setPracticeLoading(false);
      setTypingMsg({ role: "ai", text: result, id: Date.now() });
    } catch (e) {
      setPracticeLoading(false);
      setPracticeMessages(prev => [...prev, { role: "ai", text: "Something went wrong. Please try again." }]);
    }
  }, [styleProfile, authorName, trackCall]);

  const handleTypingDone = useCallback((msg) => {
    setPracticeMessages(prev => [...prev, { role: "ai", text: msg.text }]);
    setTypingMsg(null);
  }, []);

  if (!showStyleLab) return null;

  const hasProfile = styleProfile && profileSections.length > 0;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, maxWidth: 430, margin: "0 auto", background: COLORS.bg1, zIndex: 100, display: "flex", flexDirection: "column", animation: "fadeIn 0.25s ease" }}>
      {/* Header */}
      <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${COLORS.border}`, background: COLORS.card, flexShrink: 0 }}>
        <button onClick={() => setShowStyleLab(false)} style={{ width: 32, height: 32, borderRadius: 16, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, color: COLORS.muted }}>
          &#x2190;
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 15, fontWeight: 700, color: COLORS.heading }}>Style Lab</div>
          <div style={{ fontSize: 11, color: COLORS.muted }}>
            {hasProfile && authorName ? `Analysing: ${authorName}` : "Analyse & practise writing styles"}
          </div>
        </div>
        {hasProfile && (
          <button onClick={resetAll} style={{ padding: "6px 12px", borderRadius: 14, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: COLORS.muted }}>New analysis</button>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ padding: "12px 18px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", background: COLORS.bg3, borderRadius: 20, padding: 3 }}>
          {[
            { key: "analyze", label: "Analyse Style" },
            { key: "practice", label: "Practice" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { if (t.key === "practice" && !hasProfile) return; setActiveTab(t.key); }}
              style={{
                flex: 1, padding: "8px 16px", borderRadius: 17, border: "none",
                background: activeTab === t.key ? COLORS.card : "transparent",
                fontFamily: "'Courier Prime', monospace", fontSize: 12,
                color: t.key === "practice" && !hasProfile ? COLORS.accent2 : (activeTab === t.key ? COLORS.heading : COLORS.muted),
                fontWeight: activeTab === t.key ? 700 : 400,
                cursor: t.key === "practice" && !hasProfile ? "not-allowed" : "pointer",
                opacity: t.key === "practice" && !hasProfile ? 0.5 : 1,
                boxShadow: activeTab === t.key ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.2s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* ANALYSE TAB */}
        {activeTab === "analyze" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
            {!hasProfile && !analyzing && (
              <>
                {error && (
                  <div style={{ ...s.card, marginBottom: 16, padding: 14, borderLeft: `3px solid ${COLORS.red}`, background: "#FFF5F5", maxHeight: 200, overflowY: "auto" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.red, marginBottom: 4 }}>Analysis failed</div>
                    <div style={{ fontSize: 10, color: COLORS.text, lineHeight: 1.5, wordBreak: "break-all" }}>{error}</div>
                  </div>
                )}
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <FeatherIcon size={28} color={COLORS.accent1} />
                  <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 10, lineHeight: 1.5 }}>
                    Paste a passage from any writer. Lyra will identify their style and build a deep linguistic profile you can practise with.
                  </p>
                </div>
                <textarea
                  value={referenceText}
                  onChange={e => setReferenceText(e.target.value)}
                  placeholder="Paste a passage here (at least 30 words)..."
                  style={{ width: "100%", minHeight: 180, padding: 16, borderRadius: 14, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: "'Courier Prime', monospace", fontSize: 13, color: COLORS.text, resize: "vertical", lineHeight: 1.7, boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: wordCount >= 30 ? COLORS.green : COLORS.muted }}>
                    {wordCount} word{wordCount !== 1 ? "s" : ""}{wordCount < 30 ? ` (need ${30 - wordCount} more)` : " — ready"}
                  </div>
                </div>
                <button
                  onClick={analyzeStyle}
                  disabled={wordCount < 30}
                  style={{ ...s.btn, width: "100%", ...(wordCount < 30 ? s.btnDisabled : {}) }}
                >
                  Analyse Style
                </button>
              </>
            )}

            {analyzing && (
              <div style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ animation: "featherWrite 1.8s ease-in-out infinite", display: "inline-block", marginBottom: 16 }}>
                  <FeatherIcon size={32} />
                </div>
                <div style={{ fontSize: 14, color: COLORS.heading, fontWeight: 700, marginBottom: 6 }}>Analysing style...</div>
                <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>
                  Searching for the author and building a deep linguistic profile. This may take a moment.
                </div>
              </div>
            )}

            {hasProfile && !analyzing && (
              <>
                {/* Author card */}
                <div style={{ ...s.card, marginBottom: 16, textAlign: "center", padding: 20, background: COLORS.bg2 }}>
                  <FeatherIcon size={24} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.heading, marginTop: 8, fontFamily: "'Courier Prime', monospace" }}>
                    {authorName}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>Style Profile — {profileSections.length} sections analysed</div>
                </div>

                {/* Section cards */}
                {profileSections.map((section, i) => (
                  <div key={i} style={{ ...s.card, marginBottom: 12, padding: 14, borderLeft: `3px solid ${COLORS.accent1}` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent1, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.5 }}>
                      {section.title}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {section.content}
                    </div>
                  </div>
                ))}

                <div style={{ textAlign: "center", marginTop: 16, marginBottom: 8 }}>
                  <button
                    onClick={() => setActiveTab("practice")}
                    style={{ ...s.btn, padding: "12px 32px" }}
                  >
                    Start Practising
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* PRACTICE TAB */}
        {activeTab === "practice" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
              {practiceMessages.length === 0 && !typingMsg && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <FeatherIcon size={24} color={COLORS.accent2} />
                  <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 12, lineHeight: 1.5 }}>
                    Type a sentence and Lyra will rewrite it in{authorName && authorName !== "Unknown Author" ? ` ${authorName}'s` : " the analysed"} style, explaining every technique used.
                  </div>
                </div>
              )}

              {practiceMessages.map((msg, i) => (
                msg.role === "user" ? (
                  <div key={i} style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                    <div style={{ background: COLORS.heading, color: "#fff", borderRadius: "18px 18px 4px 18px", padding: "10px 16px", fontSize: 13, lineHeight: 1.6, maxWidth: "85%", whiteSpace: "pre-wrap" }}>
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <div style={{ marginTop: 4 }}><FeatherIcon size={16} /></div>
                    <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", fontSize: 13, lineHeight: 1.7, maxWidth: "85%", whiteSpace: "pre-wrap" }}>
                      {msg.text}
                    </div>
                  </div>
                )
              ))}

              {typingMsg && (
                <PracticeTypingBubble msg={typingMsg} onDone={handleTypingDone} />
              )}

              {practiceLoading && !typingMsg && (
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <div style={{ marginTop: 4 }}><FeatherIcon size={16} /></div>
                  <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", fontSize: 13 }}>
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      <span style={{ animation: "bounce 1s infinite 0s" }}>.</span>
                      <span style={{ animation: "bounce 1s infinite 0.15s" }}>.</span>
                      <span style={{ animation: "bounce 1s infinite 0.3s" }}>.</span>
                    </span>
                  </div>
                </div>
              )}

              <div ref={practiceEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px 18px 16px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.card, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={inputRef}
                  value={practiceInput}
                  onChange={e => setPracticeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && practiceInput.trim() && !practiceLoading) sendPractice(practiceInput); }}
                  placeholder="Type a sentence to transform..."
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: "'Courier Prime', monospace", fontSize: 13, color: COLORS.text, outline: "none" }}
                />
                <button
                  onClick={() => { if (practiceInput.trim() && !practiceLoading) sendPractice(practiceInput); }}
                  disabled={!practiceInput.trim() || practiceLoading}
                  style={{ width: 40, height: 40, borderRadius: 20, border: "none", background: practiceInput.trim() && !practiceLoading ? COLORS.heading : COLORS.bg3, color: "#fff", fontSize: 16, cursor: practiceInput.trim() && !practiceLoading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                >
                  &#x2192;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
