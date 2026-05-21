import { COLORS } from "../constants.js";
import { FeatherIcon } from "./Icons.jsx";

export default function MiniLessonCard({ content, rule, phrase, correction, sendChat, setTab, onClose }) {
  return (
    <div style={{ marginTop: 8, background: "#FFFDF5", border: `1.5px solid ${COLORS.amber}40`, borderRadius: 10, padding: 12, animation: "fadeUp 0.3s ease" }}>
      {content.split("\n").map((line, li) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("RULE:")) return <div key={li} style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, marginBottom: 8 }}>{trimmed.replace("RULE:", "").trim()}</div>;
        if (trimmed.startsWith("WHAT IT IS:")) return <div key={li} style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.6, marginBottom: 8 }}>{trimmed.replace("WHAT IT IS:", "").trim()}</div>;
        if (trimmed.startsWith("THE TRICK:")) return <div key={li} style={{ fontSize: 12, color: COLORS.amber, fontWeight: 700, lineHeight: 1.5, marginBottom: 8, padding: "6px 10px", background: `${COLORS.amber}10`, borderRadius: 8 }}>💡 {trimmed.replace("THE TRICK:", "").trim()}</div>;
        if (trimmed === "EXAMPLES:") return <div key={li} style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, marginBottom: 6, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>Examples</div>;
        if (trimmed.startsWith("✗")) return <div key={li} style={{ fontSize: 12, color: COLORS.red, lineHeight: 1.5, marginBottom: 2, paddingLeft: 10, borderLeft: `2px solid ${COLORS.red}30` }}>{trimmed}</div>;
        if (trimmed.startsWith("✓")) return <div key={li} style={{ fontSize: 12, color: COLORS.green, lineHeight: 1.5, marginBottom: 8, paddingLeft: 10, borderLeft: `2px solid ${COLORS.green}30` }}>{trimmed}</div>;
        if (trimmed.startsWith("REMEMBER:")) return <div key={li} style={{ fontSize: 12, fontWeight: 700, color: COLORS.heading, marginTop: 6, padding: "8px 10px", background: COLORS.bg2, borderRadius: 8, lineHeight: 1.5 }}>{trimmed.replace("REMEMBER:", "").trim()}</div>;
        return <div key={li} style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>{trimmed}</div>;
      })}
      <button onClick={() => {
        sendChat(`I'm struggling with this grammar rule: "${rule}". My mistake was: "${phrase}" → "${correction}". Can you explain it to me in a different way? Maybe with more examples?`);
        if (onClose) onClose();
        setTab("chat");
      }} style={{ marginTop: 12, width: "100%", padding: "9px 14px", borderRadius: 10, border: "none", background: COLORS.heading, fontFamily: "'Courier Prime', monospace", fontSize: 12, cursor: "pointer", color: "#fff", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <FeatherIcon size={13} color="#fff" /> Ask Lyra about this
      </button>
    </div>
  );
}
