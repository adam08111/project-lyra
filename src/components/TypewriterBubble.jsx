import { useRef, useEffect } from "react";
import { COLORS } from "../constants.js";
import { useTypewriter } from "../hooks.js";
import { FeatherIcon } from "./Icons.jsx";

export default function TypewriterBubble({ msg, onDone }) {
  const { displayed, done } = useTypewriter(msg.text, 18);
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
      <div style={{ background: "#fff", border: `1px solid #E2E5EA`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", fontSize: 14, lineHeight: 1.6, maxWidth: "85%", whiteSpace: "pre-wrap" }}>
        {displayed}{!done && <span style={{ animation: "blink 0.8s infinite", color: COLORS.accent1 }}>|</span>}
      </div>
    </div>
  );
}
