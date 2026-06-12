import { COLORS } from "./constants.js";

export const keyframes = `
@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
@keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
@keyframes slideUp { from { opacity:0; transform:translateY(40px) } to { opacity:1; transform:translateY(0) } }
@keyframes bounce { 0%,80%,100% { transform:translateY(0) } 40% { transform:translateY(-6px) } }
@keyframes shimmer { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
@keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0 } }
@keyframes pulse { 0%,100% { opacity:.7 } 50% { opacity:1 } }
@keyframes featherWrite {
  0% { transform: translateX(0) rotate(-15deg); }
  25% { transform: translateX(12px) rotate(-5deg); }
  50% { transform: translateX(24px) rotate(-15deg); }
  75% { transform: translateX(36px) rotate(-5deg); }
  100% { transform: translateX(0) rotate(-15deg); }
}
@keyframes inkTrail {
  0% { width: 0; opacity: 0.6; }
  50% { width: 60%; opacity: 0.3; }
  100% { width: 0; opacity: 0; }
}
@keyframes slideLeft { from { transform:translateX(-100%) } to { transform:translateX(0) } }
@keyframes fadeOverlay { from { opacity:0 } to { opacity:1 } }
textarea:focus, input:focus { outline: none; }
*::-webkit-scrollbar { width: 4px; height: 4px; }
*::-webkit-scrollbar-thumb { background: ${COLORS.accent2}; border-radius: 4px; }
*::-webkit-scrollbar-track { background: transparent; }
`;

export const sharedStyles = {
  app: { fontFamily: "'Courier Prime', monospace", background: COLORS.bg1, color: COLORS.text, maxWidth: 430, margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" },
  btn: { background: `linear-gradient(135deg, ${COLORS.accent1}, ${COLORS.accent2})`, color: "#fff", border: "none", borderRadius: 24, padding: "12px 28px", fontFamily: "'Courier Prime', monospace", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", letterSpacing: 0.5 },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  card: { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16 },
  chip: { padding: "8px 18px", borderRadius: 20, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 13, cursor: "pointer", transition: "all 0.2s" },
  // Full border shorthand, not borderColor: chip sets shorthand `border`, and
  // mixing the two across renders trips React's conflicting-style warning (§18.7).
  chipActive: { background: COLORS.heading, color: "#fff", border: `1.5px solid ${COLORS.heading}` },
};
