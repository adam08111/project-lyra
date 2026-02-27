import { COLORS } from "../constants.js";
import { sharedStyles as s } from "../styles.js";
import { FeatherIcon } from "./Icons.jsx";
import MiniLessonCard from "./MiniLessonCard.jsx";

export default function GrammarLog({
  grammarLog, setGrammarLog, showGrammarLog, setShowGrammarLog,
  miniLesson, fetchMiniLesson, sendChat, setTab,
}) {
  if (!showGrammarLog) return null;

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: COLORS.bg1, zIndex: 50, display: "flex", flexDirection: "column", animation: "fadeIn 0.25s ease" }}>
      {/* Header */}
      <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${COLORS.border}`, background: COLORS.card, flexShrink: 0 }}>
        <button onClick={() => setShowGrammarLog(false)} style={{ width: 32, height: 32, borderRadius: 16, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, color: COLORS.muted }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 15, fontWeight: 700, color: COLORS.heading }}>Grammar Log</div>
          <div style={{ fontSize: 11, color: COLORS.muted }}>{grammarLog.length} mistake{grammarLog.length !== 1 ? "s" : ""} recorded</div>
        </div>
        {grammarLog.length > 0 && (
          <button onClick={() => { if (confirm("Clear all grammar log entries?")) setGrammarLog([]); }} style={{ padding: "6px 12px", borderRadius: 14, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: COLORS.muted }}>Clear all</button>
        )}
      </div>

      {/* Log entries */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
        {grammarLog.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <FeatherIcon size={32} color={COLORS.accent2} />
            <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 16 }}>No grammar mistakes logged yet</div>
            <div style={{ fontSize: 12, color: COLORS.accent2, marginTop: 6 }}>Use the "Proofread" button on your draft to start building your log</div>
          </div>
        ) : (
          grammarLog.map((entry, i) => {
            const prevEntry = grammarLog[i - 1];
            const showDate = i === 0 || prevEntry?.date !== entry.date;
            return (
              <div key={entry.id}>
                {showDate && (
                  <div style={{ fontSize: 11, color: COLORS.accent1, fontWeight: 700, marginBottom: 10, marginTop: i > 0 ? 16 : 0, textTransform: "uppercase", letterSpacing: 1.5 }}>{entry.date}</div>
                )}
                <div style={{ ...s.card, marginBottom: 12, padding: 14, borderLeft: `3px solid ${COLORS.red}`, position: "relative" }}>
                  <button onClick={() => setGrammarLog(prev => prev.filter(e => e.id !== entry.id))} style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 13, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13, color: COLORS.muted, padding: 0 }}>×</button>

                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, marginBottom: 8 }}>{entry.rule}</div>

                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, background: "#FFF5F5", color: COLORS.red, flex: 1 }}>{entry.phrase}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, background: "#F0FFF0", color: COLORS.green, flex: 1 }}>{entry.correction}</div>
                  </div>

                  <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.6, marginBottom: 10 }}>{entry.explanation}</div>

                  {(entry.example_wrong || entry.example_correct) && (
                    <div style={{ background: COLORS.bg2, borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Example</div>
                      {entry.example_wrong && (
                        <div style={{ fontSize: 12, color: COLORS.red, lineHeight: 1.5, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${COLORS.red}30` }}>✗ {entry.example_wrong}</div>
                      )}
                      {entry.example_correct && (
                        <div style={{ fontSize: 12, color: COLORS.green, lineHeight: 1.5, paddingLeft: 10, borderLeft: `2px solid ${COLORS.green}30` }}>✓ {entry.example_correct}</div>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: 10, color: COLORS.accent2, marginTop: 8 }}>From: {entry.topic}</div>

                  <button onClick={() => fetchMiniLesson(entry)} style={{ marginTop: 10, width: "100%", padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: miniLesson[entry.id]?.content ? COLORS.bg3 : COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 12, cursor: "pointer", color: COLORS.heading, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}>
                    {miniLesson[entry.id]?.loading ? (
                      <><div style={{ animation: "featherWrite 1.8s ease-in-out infinite", display: "inline-block" }}><FeatherIcon size={14} /></div> Loading...</>
                    ) : miniLesson[entry.id]?.content ? (
                      "Hide lesson"
                    ) : (
                      <><FeatherIcon size={14} /> Teach me this</>
                    )}
                  </button>

                  {miniLesson[entry.id]?.content && !miniLesson[entry.id]?.loading && (
                    <MiniLessonCard
                      content={miniLesson[entry.id].content}
                      rule={entry.rule}
                      phrase={entry.phrase}
                      correction={entry.correction}
                      sendChat={sendChat}
                      setTab={setTab}
                      onClose={() => setShowGrammarLog(false)}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
