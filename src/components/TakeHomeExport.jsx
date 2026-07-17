// BRIEF-116 / §127 — "Take your work home" (custodian #4). One Sidebar action that gathers the
// on-device corpus (+ own-RLS snapshot history when sync is on), composes ONE self-contained .html,
// and downloads it. Never-stuck (#7): every path resolves to a file, an honest empty state, or a
// visible error + retry. Available flag-OFF (custodian #4 must not depend on custodian #2).
import { useState, useCallback } from "react";
import { COLORS } from "../constants.js";
import { FeatherIcon } from "./Icons.jsx";
import { gatherCorpus } from "../export/gather.js";
import { composeExport } from "../export/compose.js";
import { downloadBlob } from "../export/download.js";

export default function TakeHomeExport() {
  const [status, setStatus] = useState({ state: "idle", msg: "" });

  const run = useCallback(async () => {
    setStatus({ state: "working", msg: "" });
    try {
      const { corpus, included, omitted } = await gatherCorpus();
      const has = corpus.writings.length || corpus.learning || corpus.growth ||
        (corpus.snapshots && (corpus.snapshots.writings.length || corpus.snapshots.reports.length));
      if (!has) { setStatus({ state: "empty", msg: "Nothing to take home yet — write something first, then come back." }); return; }
      const now = new Date();
      const html = composeExport(corpus, {
        included, omitted,
        date: now.toISOString(),
        dateLabel: now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      });
      downloadBlob(`lyra-my-work-${now.toISOString().slice(0, 10)}.html`, html, "text/html;charset=utf-8");
      setStatus({ state: "done", msg: "Saved to your device — it's yours to keep, forever." });
    } catch (e) {
      setStatus({ state: "error", msg: "Couldn't create your file just now — please try again." });
    }
  }, []);

  const working = status.state === "working";
  return (
    <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
      <button
        onClick={run}
        disabled={working}
        style={{ width: "100%", padding: "11px 18px", background: "none", border: "none", cursor: working ? "default" : "pointer", fontFamily: "'Courier Prime', monospace", fontSize: 12, color: COLORS.heading, fontWeight: 700, textAlign: "left", display: "flex", alignItems: "center", gap: 8, opacity: working ? 0.6 : 1 }}
      >
        <FeatherIcon size={13} /> {working ? "Preparing your file…" : "Take your work home"}
      </button>
      {status.msg && (
        <div style={{ padding: "0 18px 10px 38px", fontSize: 11, color: status.state === "error" ? COLORS.red : COLORS.muted, lineHeight: 1.5 }}>
          {status.msg}
          {status.state === "error" && (
            <button onClick={run} style={{ marginLeft: 6, background: "none", border: "none", color: COLORS.heading, textDecoration: "underline", cursor: "pointer", fontFamily: "'Courier Prime', monospace", fontSize: 11, padding: 0 }}>Try again</button>
          )}
        </div>
      )}
    </div>
  );
}
