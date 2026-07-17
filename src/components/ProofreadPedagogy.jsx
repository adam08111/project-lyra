import { COLORS } from "../constants.js";

// §128 (BRIEF-PRV / D-P1/D-P2) — "What's working" (strengths) + "Next focus" (nextFocus). The proofread
// model generates both on EVERY call, but the results panel rendered NEITHER (§126 finding) — so paid-for
// encouragement was discarded and a band-refused proofread showed three "✓ No issues" tabs (a false clean
// bill). This renders both, ABOVE the tabs, so a refusal's warm line (which the §124 guard routes into
// these fields with empty result arrays) LEADS and the empty tabs read as context. Absent fields render
// nothing (no empty chrome). React-default escaping keeps student-typed text inert (D-P3).
const mono = "'Courier Prime', monospace";
const card = { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12 };
const label = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontFamily: mono };
const body = { fontSize: 13, color: COLORS.text, lineHeight: 1.5 };

export default function ProofreadPedagogy({ strengths, nextFocus }) {
  if (!strengths && !nextFocus) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      {strengths && (
        <div style={{ ...card, marginBottom: 8, borderLeft: `3px solid ${COLORS.green}` }}>
          <div style={{ ...label, color: COLORS.green }}>What's working</div>
          <div style={body}>{strengths}</div>
        </div>
      )}
      {nextFocus && (
        <div style={{ ...card, borderLeft: `3px solid ${COLORS.heading}` }}>
          <div style={{ ...label, color: COLORS.heading }}>Next focus</div>
          <div style={body}>{nextFocus}</div>
        </div>
      )}
    </div>
  );
}
