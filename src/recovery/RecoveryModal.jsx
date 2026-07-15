import { useState, useEffect, useCallback } from "react";
import { COLORS } from "../constants.js";
import { getSupabase } from "../supabase-client.js";
import CodeDisplay from "../enrol/CodeDisplay.jsx";
import { currentCode, regenerate, claim } from "./recovery.js";

const FORK_PENDING = "lyra-fork-pending"; // sessionStorage: initSync sets this when it detects a fork
const FORK_ACK = "lyra-fork-ack";         // sessionStorage: set when the student dismisses / claims
const ssGet = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* silent */ } };

/**
 * RECOVERY MODAL (BRIEF-112 / §121, D-G3) — one modal, two views, three ways in.
 *  • "Your code": shows this device's recovery code (reusing <CodeDisplay>, single source) with the
 *    write-it-on-paper framing + a Regenerate button (confirm step — the old code stops working).
 *  • "Use a code": type a code from another device → claim → the §99 reload re-materializes the work.
 * Ways in: (a) the Sidebar trigger dispatches a `lyra:open-recovery` window event; (b) the §99 D8
 * signal (status().identityChanged) auto-opens it in claim mode — "this device was used by a
 * different student"; (c) a brand-new device reaches "Use a code" from inside.
 *
 * Self-contained leaf (mirrors §118 EnrolOverlay) so lyra.jsx stays a one-line mount, no state.
 * D-G4: invisible when sync is off (getSupabase() null) — byte-consistent with the local-only build.
 * §109-safe: window.lyraSync.claim / .status().identityChanged are absent under a teacher session /
 * flag-off / boot error, so every access is null-guarded. Never-stuck (#7): every path resolves to a
 * shown code, an honest retryable error, or a close. English-primary copy (D-G5), no rule scaffolding.
 */
export default function RecoveryModal() {
  const configured = !!getSupabase();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("code");   // "code" | "claim"
  const [forked, setForked] = useState(false); // opened by the D8 different-student signal
  const [code, setCode] = useState("");
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!configured) return;
    // (b) D8 interstitial: a different student used this device → open in claim mode. Two paths cover
    // the initSync async-boot ordering — a session flag it sets when it detects the fork (survives
    // in-app remounts), plus a one-shot event for the instance already mounted when initSync resolves
    // (post-network). Suppressed once the student acknowledges (Continue as new / a successful claim).
    const openFork = () => {
      if (ssGet(FORK_ACK)) return;
      setForked(true); setView("claim"); setErr(""); setInput(""); setConfirmRegen(false); setOpen(true);
    };
    if (ssGet(FORK_PENDING)) openFork();
    const onIdentityChanged = () => openFork();
    // (a) the Sidebar trigger → Your code (or straight to claim if this device has no code).
    const onOpen = () => {
      const c = currentCode();
      setErr(""); setConfirmRegen(false); setInput("");
      setCode(c); setForked(false); setView(c ? "code" : "claim"); setOpen(true);
    };
    window.addEventListener("lyra:identity-changed", onIdentityChanged);
    window.addEventListener("lyra:open-recovery", onOpen);
    return () => {
      window.removeEventListener("lyra:identity-changed", onIdentityChanged);
      window.removeEventListener("lyra:open-recovery", onOpen);
    };
  }, [configured]);

  const doRegen = useCallback(async () => {
    if (regenBusy) return;
    setRegenBusy(true); setErr("");
    const fresh = await regenerate();
    if (fresh) { setCode(fresh); setConfirmRegen(false); }
    else setErr("We couldn't make a new code right now. Please try again.");
    setRegenBusy(false);
  }, [regenBusy]);

  const doClaim = useCallback(async () => {
    if (busy || !input.trim()) return;
    setBusy(true); setErr("");
    const ok = await claim(input);
    // On success window.lyraSync.claim reloads the page, so we never return here; on failure:
    if (!ok) { setErr("That code wasn't recognised. Check it and try again."); setBusy(false); }
  }, [busy, input]);

  if (!configured || !open) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <button onClick={() => setOpen(false)} aria-label="Close" style={styles.close}>×</button>

        {view === "code" ? (
          <>
            <h2 style={styles.h2}>Keep your work safe</h2>
            <p style={styles.sub}>This code brings your writing back if you lose your phone or clear your browser.</p>

            {code
              ? <div style={{ margin: "14px 0" }}><CodeDisplay code={code} /></div>
              : <p style={styles.empty}>There's no code saved on this device yet. Make one below and write it down.</p>}

            <p style={styles.teacher}>If this code doesn't work, ask your teacher.</p>

            {confirmRegen ? (
              <div style={styles.confirmBox}>
                <p style={styles.confirmText}>Your old code will stop working. Make a new one?</p>
                <button onClick={doRegen} disabled={regenBusy} style={{ ...styles.primary, opacity: regenBusy ? 0.55 : 1 }}>
                  {regenBusy ? "Making a new code…" : "Yes, make a new code"}
                </button>
                <button onClick={() => setConfirmRegen(false)} disabled={regenBusy} style={styles.ghost}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => { setErr(""); setConfirmRegen(true); }} style={styles.secondary}>
                {code ? "Make a new code" : "Make a code"}
              </button>
            )}

            {err ? <p style={styles.err} role="alert">{err}</p> : null}

            <button onClick={() => { setErr(""); setInput(""); setView("claim"); }} style={styles.link}>
              Have a code from another device?
            </button>
          </>
        ) : (
          <>
            <h2 style={styles.h2}>{forked ? "Is this you?" : "Use a recovery code"}</h2>
            <p style={styles.sub}>
              {forked
                ? "This device was used by a different student. Type your code to bring your own work back — or continue as new."
                : "Type the recovery code you wrote down to bring your writing onto this device."}
            </p>

            <label style={styles.label} htmlFor="recovery-code">Recovery code</label>
            <input
              id="recovery-code" value={input} autoFocus autoComplete="off" autoCapitalize="characters"
              inputMode="text" placeholder="XXXX-XXXX-XXXX-XXXX" maxLength={24}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doClaim(); }}
              style={{ ...styles.input, textTransform: "uppercase", letterSpacing: 2 }}
            />

            {err ? <p style={styles.err} role="alert">{err}</p> : null}

            <button onClick={doClaim} disabled={busy || !input.trim()} style={{ ...styles.primary, opacity: busy || !input.trim() ? 0.55 : 1 }}>
              {busy ? "Bringing your work back…" : "Bring my work back"}
            </button>

            {forked
              ? <button onClick={() => { ssSet(FORK_ACK, "1"); setOpen(false); }} disabled={busy} style={styles.ghost}>Continue as new</button>
              : (currentCode()
                  ? <button onClick={() => { setErr(""); setView("code"); }} style={styles.link}>Show my code instead</button>
                  : null)}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 900, background: "rgba(42,37,32,0.55)",
    display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto",
  },
  card: {
    position: "relative", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16,
    width: "100%", maxWidth: 380, margin: "auto", padding: 24, boxShadow: "0 12px 40px rgba(0,0,0,0.18)", boxSizing: "border-box",
  },
  close: {
    position: "absolute", top: 12, right: 12, width: 30, height: 30, borderRadius: 15,
    border: `1.5px solid ${COLORS.border}`, background: COLORS.card, cursor: "pointer", fontSize: 14, color: COLORS.muted,
  },
  h2: { fontSize: 22, color: COLORS.heading, margin: "0 6px 6px 0", textAlign: "center" },
  sub: { fontSize: 14, color: COLORS.muted, margin: "0 0 14px", textAlign: "center", lineHeight: 1.5 },
  empty: { fontSize: 14, color: COLORS.text, margin: "8px 0 4px", textAlign: "center", lineHeight: 1.5 },
  teacher: { fontSize: 13, color: COLORS.accent2, margin: "0 0 16px", textAlign: "center" },
  label: { display: "block", fontSize: 13, color: COLORS.muted, margin: "0 0 6px" },
  input: {
    width: "100%", boxSizing: "border-box", minHeight: 48, padding: "12px 14px", fontSize: 16,
    border: `1.5px solid ${COLORS.border}`, borderRadius: 10, marginBottom: 16, color: COLORS.text, background: COLORS.bg1, outline: "none",
  },
  primary: {
    width: "100%", minHeight: 50, fontSize: 16, fontWeight: 700, color: "#fff",
    background: COLORS.green, border: "none", borderRadius: 12, cursor: "pointer", marginTop: 4,
  },
  secondary: {
    width: "100%", minHeight: 46, fontSize: 14, fontWeight: 600, color: COLORS.heading,
    background: COLORS.bg2, border: `1.5px solid ${COLORS.border}`, borderRadius: 12, cursor: "pointer", marginTop: 4,
  },
  ghost: {
    width: "100%", minHeight: 44, fontSize: 14, color: COLORS.muted, background: "transparent",
    border: "none", cursor: "pointer", marginTop: 10,
  },
  link: {
    width: "100%", minHeight: 40, fontSize: 13, color: COLORS.accent1, background: "transparent",
    border: "none", cursor: "pointer", marginTop: 12, textDecoration: "underline",
  },
  confirmBox: { marginTop: 4 },
  confirmText: { fontSize: 14, color: COLORS.text, margin: "0 0 10px", textAlign: "center", lineHeight: 1.5 },
  err: { fontSize: 13, color: COLORS.red, margin: "10px 0 0", lineHeight: 1.5, textAlign: "center" },
};
