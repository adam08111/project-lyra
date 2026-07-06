// STUDENT DETAIL — §107. Pure presentational: props (displayName + resolved detail) → the
// read-only card. CLASS D LAW: every field is a React text child (default-escaped); there
// is NO dangerouslySetInnerHTML anywhere. We render the enrolment displayName (teacher-set)
// as the heading and deliberately do NOT render profile.studentName (the highest-risk raw
// field). The growth-profile jsonb is treated as untrusted at any depth — only whitelisted,
// text-rendered fields below are shown.
import React from "react";

const card = { border: "1px solid #dde1e8", borderRadius: 8, padding: "16px 18px", marginBottom: 18, background: "#fff" };
const h3 = { fontSize: 15, margin: "0 0 10px", color: "#171b24" };
const th = { textAlign: "left", padding: "6px 10px", borderBottom: "2px solid #dde1e8", fontSize: 13, color: "#454b58" };
const td = { padding: "6px 10px", borderBottom: "1px solid #eef0f3", fontSize: 14 };
const chip = { display: "inline-block", fontSize: 12, padding: "1px 8px", borderRadius: 10, background: "#f6f7f9", border: "1px solid #dde1e8", color: "#454b58" };

function fmtDate(iso) {
  if (!iso || typeof iso !== "string") return "";
  return iso.slice(0, 10); // YYYY-MM-DD — plain text, no locale parsing of untrusted input
}

export default function StudentDetailView({ displayName, detail, onBack }) {
  const profile = detail?.profile || null;
  const level = profile?.level || null;
  const weaknesses = Array.isArray(profile?.weaknesses) ? profile.weaknesses : [];
  const strengths = Array.isArray(profile?.strengths) ? profile.strengths : [];
  const sections = profile?.sections || null;
  const ruleFreq = Array.isArray(detail?.ruleFrequency) ? detail.ruleFrequency : [];
  const activity = detail?.activityByType || {};

  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: 14, background: "none", border: 0, color: "#274a86", cursor: "pointer", fontSize: 14, padding: 0 }}>
        ← Back to class
      </button>
      <h2 style={{ fontSize: 20, margin: "0 0 4px" }}>{displayName}</h2>
      <p style={{ color: "#454b58", fontSize: 13, margin: "0 0 20px" }}>
        Read-only insights{detail?.lastRegenAt ? ` · report updated ${fmtDate(detail.lastRegenAt)}` : ""}
      </p>

      {/* ── Growth report ─────────────────────────────────────────── */}
      {profile ? (
        <div style={card}>
          <h3 style={h3}>Growth report</h3>
          {level ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{level.name}</div>
              <div style={{ margin: "4px 0" }}>
                {level.trajectory ? <span style={{ ...chip, marginRight: 8 }}>{level.trajectory}</span> : null}
                {level.bandEstimate ? <span style={chip} title="Model estimate, not an official grade">Band estimate: {level.bandEstimate}</span> : null}
              </div>
              {level.summary ? <p style={{ margin: "6px 0 0", color: "#454b58", fontSize: 14 }}>{level.summary}</p> : null}
            </div>
          ) : null}

          {strengths.length ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "#454b58", marginBottom: 4 }}>Strengths</div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {strengths.map((s, i) => <li key={s.id || i} style={{ fontSize: 14 }}>{s.label}</li>)}
              </ul>
            </div>
          ) : null}

          {weaknesses.length ? (
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 13, color: "#454b58", marginBottom: 4 }}>Working on</div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {weaknesses.map((w, i) => (
                  <li key={w.id || i} style={{ fontSize: 14, marginBottom: 4 }}>
                    <strong>{w.label}</strong>
                    {typeof w.occurrences === "number" ? <span style={{ color: "#454b58" }}> · seen {w.occurrences}×</span> : null}
                    {w.status ? <span style={{ ...chip, marginLeft: 6 }}>{w.status}</span> : null}
                    {w.prescription?.en ? <div style={{ color: "#454b58", fontSize: 13, marginTop: 2 }}>{w.prescription.en}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {sections?.growth?.en ? <p style={{ margin: "10px 0 0", color: "#454b58", fontSize: 14 }}>{sections.growth.en}</p> : null}
        </div>
      ) : (
        <div style={card}><h3 style={h3}>Growth report</h3><p style={{ color: "#454b58", margin: 0 }}>No growth report yet — this student hasn’t generated one.</p></div>
      )}

      {/* ── Grammar rule frequency ────────────────────────────────── */}
      <div style={card}>
        <h3 style={h3}>Grammar rules</h3>
        {ruleFreq.length ? (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th style={th}>Rule</th><th style={{ ...th, textAlign: "right" }}>Times</th><th style={{ ...th, textAlign: "right" }}>Last seen</th></tr></thead>
            <tbody>
              {ruleFreq.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.rule}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{r.occurrences}</td>
                  <td style={{ ...td, textAlign: "right", color: "#454b58" }}>{fmtDate(r.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p style={{ color: "#454b58", margin: 0 }}>No grammar rules logged yet.</p>}
      </div>

      {/* ── Activity ──────────────────────────────────────────────── */}
      <div style={card}>
        <h3 style={h3}>Activity</h3>
        {Object.keys(activity).length ? (
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {Object.entries(activity).map(([type, n]) => (
              <div key={type}><span style={{ fontWeight: 700, fontSize: 18 }}>{n}</span> <span style={{ color: "#454b58", fontSize: 13 }}>{type}</span></div>
            ))}
          </div>
        ) : <p style={{ color: "#454b58", margin: 0 }}>No activity recorded yet.</p>}
      </div>
    </div>
  );
}
