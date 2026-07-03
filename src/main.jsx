import "./storage-shim.js";
import React from "react";
import ReactDOM from "react-dom/client";
import Lyra from "./lyra.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { autoRestoreFromBackup, snapshotBackup } from "./backup.js";
import { purgeInauthenticGrowthV1 } from "./learning-sync.js";
import { migrateTruncatedTitlesV1 } from "./titleGenerator.js";
import { initSync } from "./sync-init.js";

// Heal any critical localStorage key that went MISSING (stray wipe / cleared
// site data) from the last good snapshot — runs synchronously BEFORE React
// mounts so components read the restored values, not the empty ones.
const { restored } = autoRestoreFromBackup();

// One-time purge of pre-gate junk growth (meta-commentary cards) — after the
// restore so it cleans the healed state; snapshots after so the backup
// reflects the cleaned data. Idempotent (lyra-growth-purge-v1 flag).
purgeInauthenticGrowthV1({ snapshot: snapshotBackup });

// One-time heal of titles saved truncated ("…cell phones should be...")
// before the title fix — regenerated from the full topic. Runs synchronously
// BEFORE React mounts (lyra.jsx reads lyra-projects in a state initializer).
migrateTruncatedTitlesV1();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Lyra />
  </ErrorBoundary>
);

// §95: Supabase sync foundation (P0 Phase 0). Fire-and-forget AFTER mount so it never
// delays first paint; no-op unless VITE_SUPABASE_* are set. Un-awaited by design.
initSync({ restoredKeys: restored });
