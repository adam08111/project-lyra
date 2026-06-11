import { useState, useRef, useEffect } from "react";
import { COLORS, QUICK_ACTION_MESSAGES } from "../constants.js";
import { formatSources } from "../utils.js";
import { sharedStyles as s } from "../styles.js";
import { useTypewriter } from "../hooks.js";
import { FeatherIcon } from "./Icons.jsx";
import TypewriterBubble from "./TypewriterBubble.jsx";

// Render **bold** markdown as <strong> elements
const renderMd = (text) => {
  if (!text) return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    return bold ? <strong key={i}>{bold[1]}</strong> : part;
  });
};

export default function ChatTab({
  messages, setMessages, typingMsg, setTypingMsg,
  chatLoading, sendChat, stopChat, handleTypewriterDone,
  welcomeText, typeLabel, topic, draft, currentWords,
  onHelpMeStart, onDeploySkills, addToDraft, onSaveAchievement,
}) {
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const chatInputRef = useRef(null);
  const [editingMsgIdx, setEditingMsgIdx] = useState(null);
  const [editingMsgText, setEditingMsgText] = useState("");
  const [activeMsgIdx, setActiveMsgIdx] = useState(null);

  const tw = useTypewriter(welcomeText, 18);

  // Auto-scroll: when Lyra just replied (last message is AI, nothing is
  // pending), anchor on the student's MOST RECENT message so they read
  // their own question first, then Lyra's reply below it. Long LYRA_BRAIN
  // multi-paragraph turns otherwise dump the reader at the very bottom of
  // the response with no context for what was asked. Mirrors the same
  // anchoring behaviour as the training-session chat.
  // - While Lyra is typing / thinking, or after the student just sent a
  //   message, fall back to scrolling to the bottom (so they see the
  //   loader / their own latest message).
  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "ai" && !typingMsg && !chatLoading) {
      const userBubbles = container.querySelectorAll('[data-msg-role="user"]');
      const anchor = userBubbles[userBubbles.length - 1];
      if (anchor) {
        const containerRect = container.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        container.scrollTop = anchorRect.top - containerRect.top + container.scrollTop;
        return;
      }
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingMsg, chatLoading, tw.displayed]);

  // Auto-resize textarea as user types
  useEffect(() => {
    const el = chatInputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  }, [chatInput]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div ref={chatScrollRef} onClick={(e) => { if (e.target === e.currentTarget) setActiveMsgIdx(null); }} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        {/* Welcome message */}
        {welcomeText && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, animation: "fadeUp 0.3s ease" }}>
            <div style={{ marginTop: 4 }}><FeatherIcon size={16} /></div>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", fontSize: 14, lineHeight: 1.6, maxWidth: "85%", whiteSpace: "pre-wrap" }}>
              {renderMd(tw.displayed)}{!tw.done && <span style={{ animation: "blink 0.8s infinite", color: COLORS.accent1 }}>|</span>}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m, i) => (
          <div key={i} data-msg-role={m.role} style={{ display: "flex", gap: 8, marginBottom: 14, justifyContent: m.role === "user" ? "flex-end" : "flex-start", animation: "fadeUp 0.25s ease", position: "relative" }}>
            {m.role === "ai" && <div style={{ marginTop: 4 }}><FeatherIcon size={16} /></div>}
            <div style={{ maxWidth: "85%", position: "relative" }}>
              {editingMsgIdx === i ? (
                <div style={{ background: COLORS.bg2, border: `2px solid ${COLORS.heading}`, borderRadius: 14, padding: 4 }}>
                  <textarea
                    autoFocus
                    value={editingMsgText}
                    onChange={e => setEditingMsgText(e.target.value)}
                    style={{ width: "100%", minHeight: 60, padding: 12, border: "none", background: "transparent", fontFamily: "'Courier Prime', monospace", fontSize: 14, color: COLORS.text, resize: "vertical", lineHeight: 1.6, boxSizing: "border-box", outline: "none" }}
                  />
                  <div style={{ display: "flex", gap: 6, padding: "4px 8px 8px", justifyContent: "flex-end" }}>
                    <button onClick={() => { setEditingMsgIdx(null); setEditingMsgText(""); }} style={{ padding: "5px 14px", borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: COLORS.muted }}>Cancel</button>
                    <button onClick={() => {
                      setMessages(prev => prev.map((msg, idx) => idx === i ? { ...msg, text: editingMsgText } : msg));
                      setEditingMsgIdx(null);
                      setEditingMsgText("");
                    }} style={{ padding: "5px 14px", borderRadius: 12, border: "none", background: COLORS.heading, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: "#fff", fontWeight: 700 }}>Save</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setActiveMsgIdx(activeMsgIdx === i ? null : i)}
                  style={{
                    background: m.role === "user" ? `linear-gradient(135deg, ${COLORS.accent2}, ${COLORS.accent1})` : COLORS.card,
                    color: m.role === "user" ? "#fff" : COLORS.text,
                    border: m.role === "ai" ? `1px solid ${COLORS.border}` : "none",
                    borderRadius: m.role === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                    padding: "12px 16px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", cursor: "pointer",
                    outline: activeMsgIdx === i ? `2px solid ${COLORS.heading}` : "none", outlineOffset: 2,
                    transition: "outline 0.15s ease",
                  }}>{renderMd(m.text)}</div>
              )}

              {/* Sources from web-search grounding (only on AI bubbles
                  that were generated with useSearch). Click-through opens
                  the actual article — empowers the student to read it
                  themselves and use it as a verifiable example. */}
              {m.role === "ai" && Array.isArray(m.sources) && m.sources.length > 0 && editingMsgIdx !== i && (
                <div style={{ marginTop: 6, paddingLeft: 4, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                  {formatSources(m.sources).map((src, si) => (
                    <a
                      key={si}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 10, fontFamily: "'Courier Prime', monospace", color: COLORS.muted, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "2px 9px", textDecoration: "none", background: COLORS.card, whiteSpace: "nowrap" }}
                    >
                      {src.label}
                    </a>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              {activeMsgIdx === i && editingMsgIdx !== i && (
                <div style={{ display: "flex", gap: 4, marginTop: 4, justifyContent: m.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.15s ease" }}>
                  <button onClick={(e) => { e.stopPropagation(); setEditingMsgIdx(i); setEditingMsgText(m.text); setActiveMsgIdx(null); }} style={{ padding: "4px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: COLORS.muted }}>Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); setMessages(prev => prev.filter((_, idx) => idx !== i)); setActiveMsgIdx(null); }} style={{ padding: "4px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: COLORS.red }}>Delete</button>
                  {m.role === "ai" && onSaveAchievement && (
                    <button onClick={(e) => {
                      e.stopPropagation();
                      // Find the student's most recent message before this Lyra
                      // reply — that's the sentence the report is celebrating.
                      let priorUser = "";
                      for (let j = i - 1; j >= 0; j--) { if (messages[j].role === "user") { priorUser = messages[j].text; break; } }
                      onSaveAchievement(m.text, priorUser);
                      setMessages(prev => prev.map((msg, idx) => idx === i ? { ...msg, savedAchievement: true } : msg));
                      setActiveMsgIdx(null);
                    }} style={{ padding: "4px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: m.savedAchievement ? COLORS.green : COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: m.savedAchievement ? "#fff" : COLORS.green, fontWeight: m.savedAchievement ? 700 : 400, transition: "all 0.2s" }}>
                      {m.savedAchievement ? "✓ Saved" : "★ Save this turn"}
                    </button>
                  )}
                  {m.role === "user" && (
                    <button onClick={(e) => { e.stopPropagation(); setActiveMsgIdx(null); sendChat(m.text); }} style={{ padding: "4px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: COLORS.heading }}>Resend</button>
                  )}
                  {m.role === "user" && addToDraft && (
                    <button onClick={(e) => {
                      e.stopPropagation();
                      addToDraft(m.text);
                      setMessages(prev => prev.map((msg, idx) => idx === i ? { ...msg, addedToEssay: true } : msg));
                      setActiveMsgIdx(null);
                    }} style={{ padding: "4px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: m.addedToEssay ? COLORS.green : COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: m.addedToEssay ? "#fff" : COLORS.green, fontWeight: m.addedToEssay ? 700 : 400, transition: "all 0.2s" }}>
                      {m.addedToEssay ? "\u2713 Added" : "\u270e Add to essay"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing AI message */}
        {typingMsg && <TypewriterBubble msg={typingMsg} onDone={handleTypewriterDone} />}

        {/* Loading dots */}
        {chatLoading && !typingMsg && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div style={{ marginTop: 2 }}><FeatherIcon size={16} /></div>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", display: "flex", gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: COLORS.accent1, animation: `bounce 1s ${i * 0.15}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick action chips */}
      <div style={{ padding: "8px 16px", display: "flex", gap: 8, overflowX: "auto", flexShrink: 0 }}>
        {onHelpMeStart && (currentWords || 0) < 20 && (
          <button
            onClick={onHelpMeStart}
            disabled={chatLoading}
            style={{ ...s.chip, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: 12, flexShrink: 0, background: COLORS.green, color: "#fff", borderColor: COLORS.green, opacity: chatLoading ? 0.5 : 1 }}
          >
            Help me start
          </button>
        )}
        {onDeploySkills && (
          <button
            onClick={onDeploySkills}
            disabled={chatLoading}
            style={{ ...s.chip, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: 12, flexShrink: 0, background: COLORS.heading, color: "#fff", borderColor: COLORS.heading, opacity: chatLoading ? 0.5 : 1 }}
          >
            {"\u2726"} Skills
          </button>
        )}
        {[
          { label: "Outline structure", msg: `${QUICK_ACTION_MESSAGES[0]} ${typeLabel.toLowerCase()}. Show me the framework I should follow.` },
          // Both grounded chips go through the normal coaching turn (pro +
          // LYRA_BRAIN) with useSearch — the pedagogy stays in the loop.
          { label: "Brainstorm ideas", msg: QUICK_ACTION_MESSAGES[1], search: true },
          { label: "Find an example", msg: QUICK_ACTION_MESSAGES[2], search: true },
        ].map((chip, i) => (
          <button
            key={i}
            onClick={() => sendChat(chip.msg, chip.search)}
            disabled={chatLoading}
            style={{ ...s.chip, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontSize: 12, opacity: chatLoading ? 0.5 : 1, flexShrink: 0 }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Chat input */}
      <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.card, display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
        <textarea
          ref={chatInputRef}
          rows={1}
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (chatLoading || typingMsg) { stopChat(); } else if (chatInput.trim()) { sendChat(chatInput); setChatInput(""); } } }}
          placeholder={chatLoading || typingMsg ? "Lyra is thinking..." : "Ask Lyra anything..."}
          style={{ flex: 1, padding: "10px 16px", borderRadius: 20, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: "'Courier Prime', monospace", fontSize: 14, color: COLORS.text, resize: "none", overflow: "hidden", lineHeight: 1.5, minHeight: 40, maxHeight: 120 }}
        />
        {(chatLoading || typingMsg) ? (
          <button onClick={stopChat} style={{ ...s.btn, padding: "10px 18px", borderRadius: 20, fontSize: 13, background: COLORS.card, borderColor: COLORS.border, color: COLORS.muted, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: COLORS.muted }} />
          </button>
        ) : (
          <button onClick={() => { sendChat(chatInput); setChatInput(""); }} disabled={!chatInput.trim()} style={{ ...s.btn, padding: "10px 18px", borderRadius: 20, fontSize: 13, ...(!chatInput.trim() ? s.btnDisabled : {}) }}>→</button>
        )}
      </div>
    </div>
  );
}
