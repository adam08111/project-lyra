// TEACHER APP — §106. Email + password sign-in and the signed-in shell. The signed-in
// body is a placeholder here; §107 replaces it with the read-only roster → student detail.
// Every auth call resolves to content, an honest message, or a retry — never a stuck
// spinner (never-stuck #7). Desktop-first (D-B3).
import React, { useState, useEffect, useCallback } from "react";
import { currentTeacher, signIn, signOut } from "./auth.js";

const C = {
  ink: "#171b24", inkSoft: "#454b58", paper: "#ffffff", line: "#dde1e8",
  blue: "#274a86", tint: "#f6f7f9", red: "#7a2d2d",
};

const shell = {
  minHeight: "100vh", display: "flex", alignItems: "flex-start", justifyContent: "center",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  color: C.ink, padding: "48px 20px",
};
const card = {
  width: "100%", maxWidth: 420, background: C.paper, border: `1px solid ${C.line}`,
  borderRadius: 10, padding: "32px 28px", boxShadow: "0 18px 44px -30px rgba(20,26,40,.4)",
};

export default function TeacherApp() {
  const [status, setStatus] = useState("checking"); // checking | out | in | not-teacher | not-configured | error
  const [teacher, setTeacher] = useState(null);

  const resolve = useCallback(async () => {
    setStatus("checking");
    const r = await currentTeacher();
    if (r.ok) { setTeacher(r.teacher); setStatus("in"); return; }
    if (r.error === "not-configured") { setStatus("not-configured"); return; }
    if (r.error === "signed-out") { setStatus("out"); return; }
    if (r.error === "no-teacher-row") { setStatus("not-teacher"); return; }
    setStatus("error"); // query-failed / threw — retryable
  }, []);

  useEffect(() => { resolve(); }, [resolve]);

  const onSignedIn = useCallback((t) => { setTeacher(t); setStatus("in"); }, []);
  const onSignOut = useCallback(async () => { await signOut(); setTeacher(null); setStatus("out"); }, []);

  let body;
  if (status === "checking") {
    body = <p style={{ color: C.inkSoft, margin: 0 }}>Checking your session…</p>;
  } else if (status === "not-configured") {
    body = <Notice title="Not connected">The teacher panel isn’t connected to the database in this environment. Ask the Lyra operator to set the Supabase keys.</Notice>;
  } else if (status === "error") {
    body = (
      <Notice title="Couldn’t reach the server">
        <p style={{ margin: "0 0 14px" }}>Something went wrong loading your session.</p>
        <Btn onClick={resolve}>Try again</Btn>
      </Notice>
    );
  } else if (status === "not-teacher") {
    body = (
      <Notice title="Not a teacher account">
        <p style={{ margin: "0 0 14px" }}>You’re signed in, but this account isn’t set up as a teacher.</p>
        <Btn onClick={onSignOut}>Sign out</Btn>
      </Notice>
    );
  } else if (status === "in") {
    body = <SignedIn teacher={teacher} onSignOut={onSignOut} />;
  } else {
    body = <SignInForm onSignedIn={onSignedIn} />;
  }

  return (
    <div style={shell}>
      <div style={card}>
        <h1 style={{ fontSize: 22, margin: "0 0 4px", letterSpacing: "-.01em" }}>Lyra · Teacher</h1>
        <p style={{ fontSize: 13, color: C.inkSoft, margin: "0 0 22px" }}>Read-only class insights</p>
        {body}
      </div>
    </div>
  );
}

function SignInForm({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = useCallback(async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    const r = await signIn(email, password);
    setBusy(false);
    if (r.ok) { onSignedIn(r.teacher); return; }
    if (r.error === "bad-credentials") { setErr("Email or password is incorrect."); return; }
    if (r.error === "no-teacher-row") { setErr("This account isn’t set up as a teacher."); return; }
    if (r.error === "not-configured") { setErr("The teacher panel isn’t connected to the database."); return; }
    setErr("Something went wrong. Please try again.");
  }, [busy, email, password, onSignedIn]);

  return (
    <form onSubmit={submit} noValidate>
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" />
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      {err ? <p role="alert" style={{ color: C.red, fontSize: 13, margin: "0 0 14px" }}>{err}</p> : null}
      <Btn type="submit" disabled={busy} full>{busy ? "Signing in…" : "Sign in"}</Btn>
    </form>
  );
}

function SignedIn({ teacher, onSignOut }) {
  return (
    <div>
      <p style={{ margin: "0 0 6px" }}>
        Signed in as <strong>{teacher?.display_name}</strong>.
      </p>
      <p style={{ color: C.inkSoft, fontSize: 14, margin: "0 0 20px" }}>
        Your class roster and student insights will appear here.
      </p>
      <Btn onClick={onSignOut}>Sign out</Btn>
    </div>
  );
}

function Field({ label, type, value, onChange, autoComplete }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 13, color: C.inkSoft, marginBottom: 6 }}>{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 15,
          border: `1px solid ${C.line}`, borderRadius: 6, background: C.paper, color: C.ink,
        }}
      />
    </label>
  );
}

function Btn({ children, onClick, type = "button", disabled, full }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: full ? "block" : "inline-block", width: full ? "100%" : "auto",
        padding: "10px 18px", fontSize: 15, fontWeight: 600, cursor: disabled ? "default" : "pointer",
        color: C.paper, background: disabled ? "#9aa4b8" : C.blue, border: 0, borderRadius: 6,
      }}
    >
      {children}
    </button>
  );
}

function Notice({ title, children }) {
  return (
    <div style={{ background: C.tint, border: `1px solid ${C.line}`, borderRadius: 8, padding: "16px 18px" }}>
      <p style={{ fontWeight: 700, margin: "0 0 8px" }}>{title}</p>
      <div style={{ color: C.inkSoft, fontSize: 14 }}>{children}</div>
    </div>
  );
}
