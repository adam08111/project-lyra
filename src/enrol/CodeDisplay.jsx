import { COLORS } from "../constants.js";

/**
 * CodeDisplay — the recovery-code "write this down" moment (BRIEF-ENROL D-L3). Minimal + reusable:
 * BRIEF-112's recovery surface reuses THIS component (single source), so keep it self-contained and
 * presentational. Renders the code as inert monospace TEXT (never HTML) with a spaced-out grouping
 * for legibility, plus the notebook line. Returns null when there is no code (graceful).
 *
 * @param {{ code?: string, note?: string }} props
 */
export default function CodeDisplay({ code, note = "Write this inside your English notebook cover — it brings your work back if you lose your phone." }) {
  const c = String(code == null ? "" : code).trim();
  if (!c) return null;
  return (
    <div style={{ background: COLORS.bg3, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8, letterSpacing: 0.5 }}>YOUR RECOVERY CODE</div>
      <div style={{ fontFamily: "'Courier Prime', monospace", fontWeight: 700, fontSize: 24, letterSpacing: 4, color: COLORS.heading, wordBreak: "break-all" }}>{c}</div>
      <div style={{ fontSize: 13, color: COLORS.text, marginTop: 12, lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}
