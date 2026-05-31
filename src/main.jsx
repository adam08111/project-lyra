import "./storage-shim.js";
import "./api-patch.js";
import React from "react";
import ReactDOM from "react-dom/client";
import Lyra from "./lyra.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { autoRestoreFromBackup } from "./backup.js";

// Heal any critical localStorage key that went MISSING (stray wipe / cleared
// site data) from the last good snapshot — runs synchronously BEFORE React
// mounts so components read the restored values, not the empty ones.
autoRestoreFromBackup();

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Lyra />
  </ErrorBoundary>
);
