import { useCallback } from "react";
import { COLORS } from "../constants.js";

export default function DataExport({ projects, grammarLog }) {
  const exportData = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      projects,
      grammarLog,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lyra-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [projects, grammarLog]);

  const importData = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.projects) {
          await window.storage.set("lyra-projects", JSON.stringify(data.projects));
        }
        if (data.grammarLog) {
          await window.storage.set("grammar-log", JSON.stringify(data.grammarLog));
        }
        window.location.reload();
      } catch (err) {
        alert("Invalid backup file. Please select a valid Lyra backup.");
      }
    };
    input.click();
  }, []);

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button onClick={exportData} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 10, cursor: "pointer", color: COLORS.muted }}>
        Export
      </button>
      <button onClick={importData} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 10, cursor: "pointer", color: COLORS.muted }}>
        Import
      </button>
    </div>
  );
}
