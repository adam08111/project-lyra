import { useState, useRef, useEffect } from "react";
import { COLORS } from "../constants.js";
import { sharedStyles as s } from "../styles.js";
import { useTypewriter } from "../hooks.js";
import { FeatherIcon } from "./Icons.jsx";
import TypewriterBubble from "./TypewriterBubble.jsx";

export default function ChatTab({
  messages, setMessages, typingMsg, setTypingMsg,
  chatLoading, sendChat, handleTypewriterDone,
  welcomeText, typeLabel, topic, draft,
}) {
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);
  const chatScrollRef = useRef(null);
  const [editingMsgIdx, setEditingMsgIdx] = useState(null);
  const [editingMsgText, setEditingMsgText] = useState("");
  const [activeMsgIdx, setActiveMsgIdx] = useState(null);

  const tw = useTypewriter(welcomeText, 18);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingMsg, tw.displayed]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div ref={chatScrollRef} onClick={(e) => { if (e.target === e.currentTarget) setActiveMsgIdx(null); }} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
        {/* Welcome message */}
        {welcomeText && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, animation: "fadeUp 0.3s ease" }}>
            <div style={{ marginTop: 4 }}><FeatherIcon size={16} /></div>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", fontSize: 14, lineHeight: 1.6, maxWidth: "85%", whiteSpace: "pre-wrap" }}>
              {tw.displayed}{!tw.done && <span style={{ animation: "blink 0.8s infinite", color: COLORS.accent1 }}>|</span>}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 14, justifyContent: m.role === "user" ? "flex-end" : "flex-start", animation: "fadeUp 0.25s ease", position: "relative" }}>
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
                  }}>{m.text}</div>
              )}

              {/* Action buttons */}
              {activeMsgIdx === i && editingMsgIdx !== i && (
                <div style={{ display: "flex", gap: 4, marginTop: 4, justifyContent: m.role === "user" ? "flex-end" : "flex-start", animation: "fadeIn 0.15s ease" }}>
                  <button onClick={(e) => { e.stopPropagation(); setEditingMsgIdx(i); setEditingMsgText(m.text); setActiveMsgIdx(null); }} style={{ padding: "4px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: COLORS.muted }}>Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); setMessages(prev => prev.filter((_, idx) => idx !== i)); setActiveMsgIdx(null); }} style={{ padding: "4px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: COLORS.red }}>Delete</button>
                  {m.role === "user" && (
                    <button onClick={(e) => { e.stopPropagation(); setActiveMsgIdx(null); sendChat(m.text); }} style={{ padding: "4px 12px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: COLORS.heading }}>Resend</button>
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
        {[
          { label: "Outline structure", msg: `Please outline the full structure for my ${typeLabel.toLowerCase()}. Show me the framework I should follow.` },
          { label: "Brainstorm ideas", msg: "Help me brainstorm the main points and arguments for my writing." },
          { label: "Search for facts", msg: `Search the web for relevant facts, statistics, or examples I could use in my ${typeLabel.toLowerCase()} about "${topic}".`, search: true },
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
      <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.card, display: "flex", gap: 8, flexShrink: 0 }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); setChatInput(""); } }}
          placeholder="Ask Lyra anything..."
          style={{ flex: 1, padding: "10px 16px", borderRadius: 20, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: "'Courier Prime', monospace", fontSize: 14, color: COLORS.text }}
        />
        <button onClick={() => { sendChat(chatInput); setChatInput(""); }} disabled={!chatInput.trim() || chatLoading} style={{ ...s.btn, padding: "10px 18px", borderRadius: 20, fontSize: 13, ...((!chatInput.trim() || chatLoading) ? s.btnDisabled : {}) }}>→</button>
      </div>
    </div>
  );
}
