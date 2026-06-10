import "./storage-shim.js";
import "./api-patch.js";
import React from "react";
import ReactDOM from "react-dom/client";
import Lyra from "./lyra.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { autoRestoreFromBackup, snapshotBackup } from "./backup.js";
import { purgeInauthenticGrowthV1 } from "./learning-sync.js";

// Heal any critical localStorage key that went MISSING (stray wipe / cleared
// site data) from the last good snapshot — runs synchronously BEFORE React
// mounts so components read the restored values, not the empty ones.
autoRestoreFromBackup();

// One-time purge of pre-gate junk growth (meta-commentary cards) — after the
// restore so it cleans the healed state; snapshots after so the backup
// reflects the cleaned data. Idempotent (lyra-growth-purge-v1 flag).
purgeInauthenticGrowthV1({ snapshot: snapshotBackup });

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Lyra />
  </ErrorBoundary>
);
