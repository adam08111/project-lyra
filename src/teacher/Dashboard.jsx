// TEACHER DASHBOARD — §107. Container: orchestrates the read queries and the pure views
// (RosterTable, StudentDetailView), owning loading / empty / error+retry states so no path
// ever leaves a stuck spinner (never-stuck #7). Read-only; synthetic data in the demo.
import React, { useState, useEffect, useCallback } from "react";
import { myClasses, roster, studentDetail } from "./queries.js";
import RosterTable from "./RosterTable.jsx";
import StudentDetailView from "./StudentDetailView.jsx";

const wrap = {
  maxWidth: 900, margin: "0 auto", padding: "28px 24px 60px",
  fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", color: "#171b24",
};
const linkBtn = { background: "none", border: 0, color: "#274a86", cursor: "pointer", fontSize: 14, padding: 0 };

function Msg({ children }) { return <p style={{ color: "#454b58" }}>{children}</p>; }
function Retry({ onClick }) {
  return (
    <div>
      <Msg>Something went wrong loading this.</Msg>
      <button onClick={onClick} style={{ ...linkBtn, fontWeight: 600 }}>Try again</button>
    </div>
  );
}

export default function Dashboard({ teacher, onSignOut }) {
  const [classes, setClasses] = useState({ status: "loading", data: [] });
  const [classId, setClassId] = useState(null);
  const [rosterState, setRosterState] = useState({ status: "idle", rows: [] });
  const [selected, setSelected] = useState(null); // { studentId, displayName }
  const [detail, setDetail] = useState({ status: "idle", data: null });

  const loadClasses = useCallback(async () => {
    setClasses({ status: "loading", data: [] });
    const r = await myClasses();
    if (!r.ok) { setClasses({ status: r.error === "not-configured" ? "not-configured" : "error", data: [] }); return; }
    setClasses({ status: "loaded", data: r.data });
    if (r.data.length) setClassId((prev) => prev || r.data[0].id);
  }, []);

  const loadRoster = useCallback(async (id) => {
    if (!id) return;
    setRosterState({ status: "loading", rows: [] });
    const r = await roster(id);
    if (!r.ok) { setRosterState({ status: "error", rows: [] }); return; }
    setRosterState({ status: "loaded", rows: r.data });
  }, []);

  const openStudent = useCallback(async (studentId, displayName) => {
    setSelected({ studentId, displayName });
    setDetail({ status: "loading", data: null });
    const r = await studentDetail(studentId);
    if (!r.ok) { setDetail({ status: "error", data: null }); return; }
    setDetail({ status: "loaded", data: r.data });
  }, []);

  const backToRoster = useCallback(() => { setSelected(null); setDetail({ status: "idle", data: null }); }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { if (classId) loadRoster(classId); }, [classId, loadRoster]);

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Lyra · Teacher</h1>
        <button onClick={onSignOut} style={linkBtn}>Sign out</button>
      </div>
      <p style={{ color: "#454b58", fontSize: 13, margin: "0 0 24px" }}>Signed in as <strong>{teacher?.display_name}</strong> · read-only</p>

      {selected ? (
        detail.status === "loading" ? <Msg>Loading…</Msg>
          : detail.status === "error" ? <Retry onClick={() => openStudent(selected.studentId, selected.displayName)} />
            : <StudentDetailView displayName={selected.displayName} detail={detail.data} onBack={backToRoster} />
      ) : (
        <>
          {classes.status === "loading" && <Msg>Loading your classes…</Msg>}
          {classes.status === "not-configured" && <Msg>The teacher panel isn’t connected to the database in this environment.</Msg>}
          {classes.status === "error" && <Retry onClick={loadClasses} />}
          {classes.status === "loaded" && classes.data.length === 0 && <Msg>You don’t have any classes yet.</Msg>}
          {classes.status === "loaded" && classes.data.length > 0 && (
            <>
              {classes.data.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, color: "#454b58", marginRight: 8 }}>Class</label>
                  <select value={classId || ""} onChange={(e) => setClassId(e.target.value)} style={{ padding: "6px 10px", fontSize: 14 }}>
                    {classes.data.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.studentCount})</option>)}
                  </select>
                </div>
              )}
              {rosterState.status === "loading" && <Msg>Loading roster…</Msg>}
              {rosterState.status === "error" && <Retry onClick={() => loadRoster(classId)} />}
              {rosterState.status === "loaded" && <RosterTable rows={rosterState.rows} onOpen={openStudent} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
