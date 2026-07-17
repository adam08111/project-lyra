import { useCallback } from "react";
import { COLORS } from "../constants.js";
import { downloadBlob } from "../export/download.js";

export default function DataExport({ projects, grammarLog }) {
  const exportData = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      projects,
      grammarLog,
    };
    // §127: the ONE Blob+anchor download path (SSoT with the take-home export).
    downloadBlob(`lyra-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json");
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
        localStorage.setItem("lyra-sync-import-pending", "1"); // §99: initSync force-mirrors this imported history (raw write bypassed the producer hooks)
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
        Backup (.json)
      </button>
      <button onClick={importData} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 10, cursor: "pointer", color: COLORS.muted }}>
        Import
      </button>
    </div>
  );
}
