import { useState, useCallback } from "react";
import { COLORS } from "../constants.js";
import { getSupabase } from "../supabase-client.js";
import { enrolStudent } from "./enrol.js";
import CodeDisplay from "./CodeDisplay.jsx";

/**
 * ENROL OVERLAY — the one-minute phone onboarding (BRIEF-ENROL D-L3/D-L5). Three states: ENTER
 * (class code + name), SUCCESS (class confirmation + the recovery-code moment), MINIMIZED (a "Join
 * your class" pill after Skip). Mounted as a leaf on the home screen; owns its whole lifecycle so
 * lyra.jsx stays a one-line conditional.
 *
 * Invisible unless sync is on (flag pin) and the student isn't already enrolled — renders null in
 * both cases. All student-typed / server-returned strings render as React TEXT children (default-
 * escaped), so a hostile name/class can never run in this or the teacher's session (Class D).
 * Every enrol path resolves to success, an honest retryable error, or Skip — never stuck (#7).
 * 430px-first: big fields + big keys; the card scrolls inside the overlay when the keyboard opens.
 */
const ENROL_STATE_KEY = "lyra-enrol-state";     // localStorage: "enrolled" once done
const SKIPPED_KEY = "lyra-enrol-skipped";       // sessionStorage: pill (not modal) after a skip this session

const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* silent */ } };
const ssGet = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* silent */ } };

const ERR = {
  "not-recognised": "We couldn't find that class code. Check it with your teacher and try again.",
  "not-configured": "Class join isn't available right now. You can keep writing — try again later.",
  error: "Something went wrong. Please try again.",
};

export default function EnrolOverlay({ userName = "" }) {
  const configured = !!getSupabase();
  const alreadyEnrolled = lsGet(ENROL_STATE_KEY) === "enrolled";
  const [view, setView] = useState(() => (ssGet(SKIPPED_KEY) ? "min" : "enter"));
  const [code, setCode] = useState("");
  const [name, setName] = useState(userName || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [closed, setClosed] = useState(false);
  // Read the recovery code at SUCCESS time, not at mount: a first-boot student's code is written by
  // ensureStudent, and enrol only succeeds once that student exists (current_student_id() non-null),
  // so at success the code is guaranteed present — a mount-time read could be stale-empty.
  const [recoveryCode, setRecoveryCode] = useState("");

  const submit = useCallback(async () => {
    if (busy) return;
    setBusy(true); setErr("");
    const r = await enrolStudent(code, name);
    if (r.ok) {
      lsSet(ENROL_STATE_KEY, "enrolled");
      setRecoveryCode(lsGet("lyra-recovery-code") || "");
      setResult(r.class);
      setView("success");
    } else {
      setErr(ERR[r.reason] || ERR.error);
    }
    setBusy(false);
  }, [busy, code, name]);

  const skip = useCallback(() => { ssSet(SKIPPED_KEY, "1"); setErr(""); setView("min"); }, []);

  // Flag off, dismissed after success, or already enrolled (and not mid-success-card) → nothing.
  if (!configured || closed) return null;
  if (alreadyEnrolled && view !== "success") return null;

  if (view === "min") {
    return (
      <button onClick={() => { setErr(""); setView("enter"); }} style={styles.pill} aria-label="Join your class">
        + Join your class
      </button>
    );
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {view === "success" ? (
          <>
            <div style={styles.tick}>✓</div>
            <h2 style={styles.h2}>You're in{name.trim() ? `, ${name.trim()}` : ""}!</h2>
            <p style={styles.confirm}>
              {result?.name ? <>You joined <strong>{result.name}</strong></> : "You joined your class"}
              {result?.teacher ? <> — {result.teacher}'s class.</> : "."}
            </p>
            <div style={{ margin: "18px 0" }}><CodeDisplay code={recoveryCode} /></div>
            <button onClick={() => setClosed(true)} style={styles.primary}>Done</button>
          </>
        ) : (
          <>
            <h2 style={styles.h2}>Join your class</h2>
            <p style={styles.sub}>Enter the class code your teacher gave you.</p>

            <label style={styles.label} htmlFor="enrol-code">Class code</label>
            <input
              id="enrol-code" value={code} autoFocus autoComplete="off" autoCapitalize="characters"
              inputMode="text" placeholder="e.g. 7B-KESTREL" maxLength={24}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              style={{ ...styles.input, textTransform: "uppercase", letterSpacing: 2 }}
            />

            <label style={styles.label} htmlFor="enrol-name">Your name</label>
            <input
              id="enrol-name" value={name} autoComplete="off" maxLength={40}
              placeholder="What should your teacher call you?"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              style={styles.input}
            />

            {err ? <p style={styles.err} role="alert">{err}</p> : null}

            <button onClick={submit} disabled={busy || !code.trim()} style={{ ...styles.primary, opacity: busy || !code.trim() ? 0.55 : 1 }}>
              {busy ? "Joining…" : "Join class"}
            </button>
            <button onClick={skip} disabled={busy} style={styles.skip}>Skip for now</button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 900, background: "rgba(42,37,32,0.55)",
    display: "flex", alignItems: "flex-start", justifyContent: "center",
    padding: 16, overflowY: "auto",
  },
  card: {
    background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16,
    width: "100%", maxWidth: 380, margin: "auto", padding: 24,
    boxShadow: "0 12px 40px rgba(0,0,0,0.18)", boxSizing: "border-box",
  },
  h2: { fontSize: 22, color: COLORS.heading, margin: "0 0 6px", textAlign: "center" },
  sub: { fontSize: 14, color: COLORS.muted, margin: "0 0 20px", textAlign: "center" },
  confirm: { fontSize: 15, color: COLORS.text, margin: "0 0 4px", textAlign: "center", lineHeight: 1.5 },
  label: { display: "block", fontSize: 13, color: COLORS.muted, margin: "0 0 6px" },
  input: {
    width: "100%", boxSizing: "border-box", minHeight: 48, padding: "12px 14px",
    fontSize: 16, border: `1.5px solid ${COLORS.border}`, borderRadius: 10,
    marginBottom: 16, color: COLORS.text, background: COLORS.bg1, outline: "none",
  },
  primary: {
    width: "100%", minHeight: 50, fontSize: 16, fontWeight: 700, color: "#fff",
    background: COLORS.green, border: "none", borderRadius: 12, cursor: "pointer", marginTop: 4,
  },
  skip: {
    width: "100%", minHeight: 44, fontSize: 14, color: COLORS.muted,
    background: "transparent", border: "none", cursor: "pointer", marginTop: 10,
  },
  err: { fontSize: 13, color: COLORS.red, margin: "0 0 12px", lineHeight: 1.5 },
  tick: {
    width: 56, height: 56, borderRadius: "50%", background: COLORS.green, color: "#fff",
    fontSize: 30, lineHeight: "56px", textAlign: "center", margin: "0 auto 14px",
  },
  pill: {
    position: "fixed", right: 14, bottom: 14, zIndex: 850, minHeight: 44, padding: "0 18px",
    fontSize: 14, fontWeight: 700, color: "#fff", background: COLORS.green,
    border: "none", borderRadius: 22, boxShadow: "0 6px 18px rgba(0,0,0,0.22)", cursor: "pointer",
  },
};
