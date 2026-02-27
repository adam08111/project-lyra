import { useRef, useCallback } from "react";
import { COLORS } from "../constants.js";
import { sharedStyles as s } from "../styles.js";
import { FeatherIcon } from "./Icons.jsx";
import MiniLessonCard from "./MiniLessonCard.jsx";

export default function EditorTab({
  draft, setDraft, wordCount, currentWords, progress, goalReached, wcLabel,
  ghostText, setGhostText, acceptGhost,
  suggestions, setSuggestions, sugBadge, setSugBadge, applySuggestion,
  proofread, setProofread, proofTab, setProofTab, proofLoading, runProofread, checkFlash,
  miniLesson, fetchMiniLesson, sendChat, setTab,
}) {
  const textareaRef = useRef(null);
  const cursorPosRef = useRef(0);

  const handleEditorKeyDown = useCallback((e) => {
    if (e.key === "Tab" && ghostText) {
      e.preventDefault();
      acceptGhost();
    } else if (ghostText) {
      setGhostText("");
    }
  }, [ghostText, acceptGhost, setGhostText]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Editor toolbar */}
      <div style={{ padding: "8px 18px", display: "flex", alignItems: "center", justifyContent: "flex-end", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <button onClick={runProofread} disabled={!draft.trim() || proofLoading} style={{ ...s.chip, fontSize: 12, display: "flex", alignItems: "center", gap: 4, opacity: (!draft.trim() || proofLoading) ? 0.4 : 1, background: checkFlash ? COLORS.green : (draft.trim() ? COLORS.card : COLORS.bg2), color: checkFlash ? "#fff" : COLORS.text, borderColor: checkFlash ? COLORS.green : COLORS.border, transition: "all 0.3s ease", flexShrink: 0 }}>
          {checkFlash ? "✓ Logged!" : "Proofread"}
        </button>
      </div>

      {/* Word count bar */}
      <div style={{ padding: "10px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: COLORS.muted }}>{currentWords} / {wcLabel} words</span>
          {goalReached && <span style={{ color: COLORS.green, fontWeight: 700 }}>✓ Goal reached!</span>}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: COLORS.bg3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, borderRadius: 3, background: goalReached ? COLORS.green : `linear-gradient(90deg, ${COLORS.accent1}, ${COLORS.accent2})`, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Mobile Ghost Hint Bar */}
      {ghostText && (
        <div style={{
          padding: "8px 18px",
          background: COLORS.logoBg2,
          borderBottom: `1px solid ${COLORS.border}`,
          fontSize: 13,
          color: COLORS.muted,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          animation: "fadeIn 0.2s ease",
          flexShrink: 0
        }}>
          <span style={{ opacity: 0.8, fontStyle: "italic", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            "{ghostText}"
          </span>
          <button
            onClick={(e) => {
              e.preventDefault();
              acceptGhost();
              setTimeout(() => textareaRef.current?.focus(), 10);
            }}
            style={{
              fontSize: 12,
              background: COLORS.heading,
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 14,
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              fontFamily: "'Courier Prime', monospace",
              flexShrink: 0
            }}
          >
            Accept →
          </button>
        </div>
      )}

      {/* Editor area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => { setDraft(e.target.value); cursorPosRef.current = e.target.selectionStart; }}
          onKeyDown={handleEditorKeyDown}
          onSelect={e => { cursorPosRef.current = e.target.selectionStart; }}
          placeholder="Start writing here... Lyra is watching and will offer guidance as you go."
          style={{ width: "100%", height: "100%", padding: "16px 18px", fontFamily: "'Courier Prime', monospace", fontSize: 15, lineHeight: 1.8, color: COLORS.text, background: "transparent", border: "none", resize: "none", position: "relative", zIndex: 2, boxSizing: "border-box" }}
        />
      </div>

      {/* Style suggestions badge */}
      {sugBadge && suggestions && (
        <div onClick={() => setSugBadge(false)} style={{ position: "absolute", bottom: 120, right: 18, background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 20, padding: "8px 16px", fontSize: 12, color: COLORS.heading, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", animation: "fadeUp 0.3s ease", zIndex: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <FeatherIcon size={14} /> Style suggestions available
        </div>
      )}

      {/* Structural suggestions panel */}
      {suggestions && !sugBadge && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "60%", overflowY: "auto", background: COLORS.card, borderTop: `1.5px solid ${COLORS.border}`, borderRadius: "18px 18px 0 0", padding: "18px", boxShadow: "0 -8px 32px rgba(0,0,0,0.08)", animation: "slideUp 0.3s ease", zIndex: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 15, fontWeight: 700, color: COLORS.heading, display: "flex", alignItems: "center", gap: 6 }}><FeatherIcon size={16} color={COLORS.heading} /> Style Suggestions</div>
            <button onClick={() => setSuggestions(null)} style={{ background: "none", border: "none", fontSize: 18, color: COLORS.muted, cursor: "pointer" }}>×</button>
          </div>
          {suggestions.map((sug, i) => (
            <div key={i} style={{ ...s.card, marginBottom: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.blue, marginBottom: 4 }}>{sug.technique}</div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10 }}>{sug.description}</div>
              <div style={{ fontSize: 12, padding: "8px 10px", borderRadius: 8, background: "#FFF5F5", color: COLORS.red, marginBottom: 6, lineHeight: 1.5 }}>{sug.original}</div>
              <div style={{ fontSize: 12, padding: "8px 10px", borderRadius: 8, background: "#F0F8FF", color: COLORS.blue, marginBottom: 8, lineHeight: 1.5 }}>{sug.improved}</div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10, lineHeight: 1.5 }}>{sug.explanation}</div>
              <button onClick={() => applySuggestion(sug)} style={{ ...s.chip, fontSize: 11, background: COLORS.bg2, color: COLORS.heading }}>Apply this improvement</button>
            </div>
          ))}
        </div>
      )}

      {/* Proofread panel */}
      {(proofread || proofLoading) && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "70%", overflowY: "auto", background: COLORS.card, borderTop: `1.5px solid ${COLORS.border}`, borderRadius: "18px 18px 0 0", padding: "18px", boxShadow: "0 -8px 32px rgba(0,0,0,0.08)", animation: "slideUp 0.3s ease", zIndex: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 15, fontWeight: 700, color: COLORS.heading }}>Doing the magic</div>
            <button onClick={() => setProofread(null)} style={{ background: "none", border: "none", fontSize: 18, color: COLORS.muted, cursor: "pointer" }}>×</button>
          </div>

          {proofLoading ? (
            <div style={{ textAlign: "center", padding: "36px 24px" }}>
              <div style={{ position: "relative", height: 50, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 10, left: "50%", marginLeft: -40, animation: "featherWrite 1.8s ease-in-out infinite" }}>
                  <FeatherIcon size={32} />
                </div>
                <div style={{ position: "absolute", bottom: 6, left: "15%", height: 2, borderRadius: 1, background: COLORS.accent2, animation: "inkTrail 1.8s ease-in-out infinite" }} />
                <div style={{ position: "absolute", bottom: 14, left: "20%", height: 2, borderRadius: 1, background: COLORS.accent2, animation: "inkTrail 1.8s 0.3s ease-in-out infinite" }} />
                <div style={{ position: "absolute", bottom: 22, left: "10%", height: 2, borderRadius: 1, background: COLORS.accent2, animation: "inkTrail 1.8s 0.6s ease-in-out infinite" }} />
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted }}>Doing the magic...</div>
            </div>
          ) : proofread && (
            <>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16, background: COLORS.bg2, borderRadius: 10, padding: 3 }}>
                {[
                  { id: "grammar", label: "Grammar", color: COLORS.red },
                  { id: "style", label: "Style", color: COLORS.amber },
                  { id: "vocabulary", label: "Vocab", color: COLORS.blue },
                ].map(t => (
                  <button key={t.id} onClick={() => setProofTab(t.id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", background: proofTab === t.id ? COLORS.card : "transparent", fontFamily: "'Courier Prime', monospace", fontSize: 12, color: proofTab === t.id ? t.color : COLORS.muted, fontWeight: proofTab === t.id ? 700 : 400, cursor: "pointer", boxShadow: proofTab === t.id ? "0 1px 4px rgba(0,0,0,0.06)" : "none" }}>{t.label}</button>
                ))}
              </div>

              {/* Grammar tab */}
              {proofTab === "grammar" && proofread.grammar?.map((g, i) => (
                <div key={i} style={{ ...s.card, marginBottom: 10, padding: 12 }}>
                  <div style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, background: "#FFF5F5", color: COLORS.red, display: "inline-block", marginBottom: 6 }}>{g.phrase}</div>
                  <div style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, background: "#F0FFF0", color: COLORS.green, display: "inline-block", marginLeft: 6, marginBottom: 6 }}>{g.correction}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.heading, marginBottom: 4, marginTop: 6 }}>{g.rule}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.5, marginBottom: 8 }}>{g.explanation}</div>
                  {(g.example_wrong || g.example_correct) && (
                    <div style={{ background: COLORS.bg2, borderRadius: 8, padding: 10, marginBottom: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Example</div>
                      {g.example_wrong && <div style={{ fontSize: 11, color: COLORS.red, lineHeight: 1.5, marginBottom: 4 }}>✗ {g.example_wrong}</div>}
                      {g.example_correct && <div style={{ fontSize: 11, color: COLORS.green, lineHeight: 1.5 }}>✓ {g.example_correct}</div>}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: COLORS.accent2, marginTop: 4 }}>Saved to Grammar Log</div>
                  <button onClick={() => {
                    const fakeEntry = { id: "proof_" + i, rule: g.rule, phrase: g.phrase, correction: g.correction, explanation: g.explanation };
                    fetchMiniLesson(fakeEntry);
                  }} style={{ marginTop: 8, width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${COLORS.border}`, background: miniLesson["proof_" + i]?.content ? COLORS.bg3 : COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: COLORS.heading, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }}>
                    {miniLesson["proof_" + i]?.loading ? (
                      <><div style={{ animation: "featherWrite 1.8s ease-in-out infinite", display: "inline-block" }}><FeatherIcon size={12} /></div> Loading...</>
                    ) : miniLesson["proof_" + i]?.content ? (
                      "Hide lesson"
                    ) : (
                      <><FeatherIcon size={12} /> Teach me this</>
                    )}
                  </button>
                  {miniLesson["proof_" + i]?.content && !miniLesson["proof_" + i]?.loading && (
                    <MiniLessonCard content={miniLesson["proof_" + i].content} rule={g.rule} phrase={g.phrase} correction={g.correction} sendChat={sendChat} setTab={setTab} />
                  )}
                </div>
              ))}

              {/* Style tab */}
              {proofTab === "style" && proofread.style?.map((st, i) => (
                <div key={i} style={{ ...s.card, marginBottom: 10, padding: 12, borderLeft: `3px solid ${COLORS.amber}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.amber, marginBottom: 6 }}>{st.observation}</div>
                  <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>{st.suggestion}</div>
                </div>
              ))}

              {/* Vocabulary tab */}
              {proofTab === "vocabulary" && proofread.vocabulary?.map((v, i) => (
                <div key={i} style={{ ...s.card, marginBottom: 10, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: COLORS.muted, textDecoration: "line-through" }}>{v.weak}</span>
                    <span style={{ fontSize: 12, color: COLORS.muted }}>→</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.blue }}>{v.stronger}</span>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>{v.reason}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Ask Lyra button */}
      <div style={{ padding: "10px 18px 8px", display: "flex", gap: 10, flexShrink: 0 }}>
        <button onClick={() => { if (draft.trim()) { sendChat(`Here's my current draft:\n\n"${draft.slice(0, 800)}"\n\nWhat should I work on next?`); setTab("chat"); } }} disabled={!draft.trim()} style={{ ...s.btn, flex: 1, fontSize: 13, padding: "11px 16px", background: COLORS.card, color: COLORS.heading, border: `1.5px solid ${COLORS.border}`, opacity: !draft.trim() ? 0.4 : 1 }}>Ask Lyra →</button>
      </div>
    </div>
  );
}
