import { useState } from "react";
import { COLORS, writingTypes } from "../constants.js";
import { FeatherIcon } from "./Icons.jsx";
import DataExport from "./DataExport.jsx";

export default function Sidebar({
  sidebarOpen, setSidebarOpen, projects, setProjects, activeWritingId,
  expandedProjects, setExpandedProjects, editingProjectId, setEditingProjectId,
  editingProjectName, setEditingProjectName, createProject, renameProject,
  deleteProject, moveWriting, deleteWriting, loadWriting, onNewWriting, grammarLog,
  setShowStyleLab,
}) {
  const [search, setSearch] = useState("");

  if (!sidebarOpen) return null;

  const searchLower = search.trim().toLowerCase();

  // Filter writings by search keyword across title, topic, and draft
  const filterWritings = (writings) => {
    if (!searchLower) return writings;
    return writings.filter(w =>
      (w.title || "").toLowerCase().includes(searchLower) ||
      (w.topic || "").toLowerCase().includes(searchLower) ||
      (w.draft || "").toLowerCase().includes(searchLower)
    );
  };

  return (
    <>
      <div onClick={() => setSidebarOpen(false)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.25)", zIndex: 60, animation: "fadeOverlay 0.2s ease" }} />
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "82%", maxWidth: 340, background: COLORS.bg1, zIndex: 70, display: "flex", flexDirection: "column", boxShadow: "4px 0 24px rgba(0,0,0,0.1)", animation: "slideLeft 0.25s ease" }}>
        <div style={{ padding: "18px 18px 14px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.card }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative", top: -2 }}><FeatherIcon size={22} /></div>
              <span style={{ fontFamily: "'Special Elite', cursive", fontSize: 18, color: COLORS.heading, lineHeight: 1 }}>Lyra</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{ width: 30, height: 30, borderRadius: 15, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, color: COLORS.muted }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={onNewWriting} style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 12, cursor: "pointer", color: COLORS.heading, fontWeight: 700 }}>+ New Writing</button>
            <button onClick={createProject} style={{ padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 12, cursor: "pointer", color: COLORS.muted }}>+ Project</button>
          </div>
          <button onClick={() => { setShowStyleLab(true); setSidebarOpen(false); }} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: "'Courier Prime', monospace", fontSize: 12, cursor: "pointer", color: COLORS.heading, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10, transition: "all 0.2s" }}>
            <FeatherIcon size={14} /> Style Lab
          </button>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search writings..."
              style={{ width: "100%", padding: "8px 12px 8px 30px", borderRadius: 8, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: "'Courier Prime', monospace", fontSize: 12, color: COLORS.text, outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: COLORS.muted, pointerEvents: "none" }}>⌕</span>
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", fontSize: 12, color: COLORS.muted, cursor: "pointer", padding: "0 2px" }}>×</button>
            )}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
          {projects.map(proj => {
            const filtered = filterWritings(proj.writings);
            // If searching and no matches in this project, hide it
            if (searchLower && filtered.length === 0) return null;
            return (
              <div key={proj.id}>
                <div style={{ padding: "8px 18px", display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setExpandedProjects(prev => ({ ...prev, [proj.id]: !prev[proj.id] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: COLORS.muted, padding: 0, width: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.2s", transform: (expandedProjects[proj.id] || searchLower) ? "rotate(90deg)" : "rotate(0deg)" }}>▶</button>
                  {editingProjectId === proj.id ? (
                    <input autoFocus value={editingProjectName} onChange={e => setEditingProjectName(e.target.value)} onBlur={() => renameProject(proj.id, editingProjectName)} onKeyDown={e => { if (e.key === "Enter") renameProject(proj.id, editingProjectName); }} style={{ flex: 1, fontFamily: "'Courier Prime', monospace", fontSize: 13, fontWeight: 700, color: COLORS.heading, border: "none", background: COLORS.bg2, padding: "4px 8px", borderRadius: 6 }} />
                  ) : (
                    <div onClick={() => setExpandedProjects(prev => ({ ...prev, [proj.id]: !prev[proj.id] }))} style={{ flex: 1, fontSize: 13, fontWeight: 700, color: COLORS.heading, cursor: "pointer" }}>
                      {proj.name}
                      <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 400, marginLeft: 6 }}>{filtered.length}{searchLower && filtered.length !== proj.writings.length ? `/${proj.writings.length}` : ""}</span>
                    </div>
                  )}
                  <button onClick={() => { setEditingProjectId(proj.id); setEditingProjectName(proj.name); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: COLORS.accent2, padding: "2px 4px" }}>✎</button>
                  {proj.id !== "default" && (
                    <button onClick={() => { if (confirm(`Delete "${proj.name}"? Writings will move to My Writings.`)) deleteProject(proj.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: COLORS.accent2, padding: "2px 4px" }}>✕</button>
                  )}
                </div>
                {(expandedProjects[proj.id] || searchLower) && (
                  <div style={{ padding: "0 18px 4px 42px" }}>
                    {filtered.length === 0 && (
                      <div style={{ fontSize: 11, color: COLORS.accent2, padding: "6px 0", fontStyle: "italic" }}>No writings yet</div>
                    )}
                    {filtered.map(w => (
                      <div key={w.id} onClick={() => loadWriting(w)} style={{ padding: "10px 12px", marginBottom: 6, borderRadius: 10, background: activeWritingId === w.id ? COLORS.bg3 : COLORS.card, border: `1px solid ${activeWritingId === w.id ? COLORS.accent1 : COLORS.border}`, cursor: "pointer", transition: "all 0.2s" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.heading, lineHeight: 1.4, wordBreak: "break-word" }}>{w.title || "Untitled"}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                          <div style={{ fontSize: 10, color: COLORS.accent2 }}>{w.draft?.trim().split(/\s+/).length || 0} words · {w.updatedAt ? new Date(w.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</div>
                          <button onClick={e => { e.stopPropagation(); if (confirm("Delete this writing?")) deleteWriting(w.id, proj.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: COLORS.red, padding: "2px 4px", opacity: 0.7, transition: "opacity 0.2s" }} title="Delete writing">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {searchLower && projects.every(p => filterWritings(p.writings).length === 0) && (
            <div style={{ textAlign: "center", padding: "24px 18px", color: COLORS.muted, fontSize: 12, fontStyle: "italic" }}>No writings match "{search}"</div>
          )}
        </div>
        <div style={{ padding: "12px 18px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, color: COLORS.accent2 }}>{projects.reduce((sum, p) => sum + p.writings.length, 0)} writings across {projects.length} project{projects.length !== 1 ? "s" : ""}</div>
          <DataExport projects={projects} grammarLog={grammarLog} />
        </div>
      </div>
    </>
  );
}
