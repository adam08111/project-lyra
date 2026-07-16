// TEACHER REGEN CONTROL — §123 (BRIEF-TR, D-M4). Owns the regenerate-a-student's-code flow state so
// StudentDetailView stays presentational. Button → confirm dialog (old code dies now; device/work
// unaffected; shown once) → on success <CodeDisplay> + the D-M3 self-regen nudge → Done discards the
// plaintext from state. CLASS D: the student displayName is rendered ONLY as an inert React text
// child. Nothing here persists the code — the lib never writes storage (D-M5). Never-stuck: every
// path resolves to a shown code, an honest retryable error, or a close.
import React, { useState, useCallback } from "react";
import CodeDisplay from "../enrol/CodeDisplay.jsx";
import { teacherRegenCode } from "./regen.js";

const C = { ink: "#171b24", inkSoft: "#454b58", line: "#dde1e8", blue: "#274a86", red: "#7a2d2d", tint: "#f6f7f9", paper: "#fff" };

const ERR = {
  "not-permitted": "You can only regenerate a code for a student in your own classes.",
  "not-configured": "The teacher panel isn’t connected to the database in this environment.",
  error: "Something went wrong. Please try again.",
};

export default function RegenControl({ studentId, displayName }) {
  const [view, setView] = useState("idle");   // idle | confirm | done
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await teacherRegenCode(studentId);
      if (r.status === "ok") { setCode(r.code); setErr(""); setView("done"); }
      else setErr(ERR[r.status] || ERR.error);
    } finally {
      setBusy(false);   // never leave the button stuck on "Regenerating…", even if the lib ever throws
    }
  }, [busy, studentId]);

  const done = useCallback(() => { setCode(""); setErr(""); setView("idle"); }, []);

  return (
    <div style={styles.card}>
      <h3 style={styles.h3}>Recovery code</h3>

      {view === "done" ? (
        <>
          <p style={styles.p}>New code for <strong>{displayName}</strong> — shown once. Write it down and hand it to them now.</p>
          <div style={{ margin: "12px 0" }}><CodeDisplay code={code} /></div>
          <p style={styles.nudge}>Once they’re back in on a device, ask them to regenerate their own code (in the app: sidebar → “Lost your phone?”). That replaces this one, so no one else keeps a working copy.</p>
          <button onClick={done} style={styles.primary}>Done</button>
        </>
      ) : (
        <>
          <p style={styles.p}>If <strong>{displayName}</strong> lost their phone and their code, make a new one here and hand it to them on paper. Their writing stays safe.</p>
          {err ? <p style={styles.err} role="alert">{err}</p> : null}
          <button onClick={() => { setErr(""); setView("confirm"); }} style={styles.primary}>Regenerate recovery code</button>
        </>
      )}

      {view === "confirm" ? (
        <div style={styles.overlay} role="dialog" aria-modal="true">
          <div style={styles.dialog}>
            <h3 style={{ ...styles.h3, marginTop: 0 }}>Regenerate code for {displayName}?</h3>
            <ul style={styles.list}>
              <li>Their old code stops working immediately.</li>
              <li>Their device and their writing are not affected.</li>
              <li>The new code is shown once — write it down before you close it.</li>
            </ul>
            {err ? <p style={styles.err} role="alert">{err}</p> : null}
            <button onClick={run} disabled={busy} style={{ ...styles.primary, opacity: busy ? 0.55 : 1 }}>
              {busy ? "Regenerating…" : "Yes, regenerate"}
            </button>
            <button onClick={() => { setErr(""); setView("idle"); }} disabled={busy} style={styles.ghost}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  card: { border: `1px solid ${C.line}`, borderRadius: 8, padding: "16px 18px", marginBottom: 18, background: C.paper },
  h3: { fontSize: 15, margin: "0 0 10px", color: C.ink },
  p: { color: C.inkSoft, fontSize: 14, margin: "0 0 12px", lineHeight: 1.5 },
  nudge: { color: C.inkSoft, fontSize: 13, margin: "0 0 14px", lineHeight: 1.5, background: C.tint, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px" },
  err: { color: C.red, fontSize: 13, margin: "0 0 12px" },
  primary: { minHeight: 40, padding: "0 16px", fontSize: 14, fontWeight: 700, color: "#fff", background: C.blue, border: "none", borderRadius: 8, cursor: "pointer" },
  ghost: { minHeight: 40, padding: "0 16px", fontSize: 14, color: C.inkSoft, background: "transparent", border: "none", cursor: "pointer", marginLeft: 8 },
  list: { color: C.inkSoft, fontSize: 14, lineHeight: 1.6, margin: "0 0 14px", paddingLeft: 20 },
  overlay: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(23,27,36,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  dialog: { background: C.paper, border: `1px solid ${C.line}`, borderRadius: 12, width: "100%", maxWidth: 420, padding: 22, boxShadow: "0 12px 40px rgba(0,0,0,0.2)", boxSizing: "border-box" },
};
