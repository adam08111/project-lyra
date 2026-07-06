// ROSTER TABLE — §107. Pure presentational: props → a plain table. Every cell is a React
// text child (default-escaped) — Class D: display_name is teacher-entered but still treated
// as untrusted and never rendered as HTML.
import React from "react";

const TYPES = [
  ["grammar", "Grammar"],
  ["skill_deployed", "Skills"],
  ["structure", "Structures"],
  ["vocabulary", "Vocab"],
  ["growth", "Growth"],
  ["report", "Reports"],
];

const th = { textAlign: "left", padding: "8px 12px", borderBottom: "2px solid #dde1e8", fontSize: 13, color: "#454b58" };
const td = { padding: "8px 12px", borderBottom: "1px solid #eef0f3", fontSize: 14 };

export default function RosterTable({ rows, onOpen }) {
  if (!rows || rows.length === 0) {
    return <p style={{ color: "#454b58" }}>No students are enrolled in this class yet.</p>;
  }
  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          <th style={th}>Student</th>
          {TYPES.map(([k, label]) => <th key={k} style={{ ...th, textAlign: "right" }}>{label}</th>)}
          <th style={{ ...th, textAlign: "right" }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.studentId}
            onClick={() => onOpen && onOpen(r.studentId, r.displayName)}
            style={{ cursor: onOpen ? "pointer" : "default" }}
          >
            <td style={{ ...td, color: "#274a86", fontWeight: 600 }}>{r.displayName}</td>
            {TYPES.map(([k]) => <td key={k} style={{ ...td, textAlign: "right" }}>{r.counts?.[k] || 0}</td>)}
            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{r.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
