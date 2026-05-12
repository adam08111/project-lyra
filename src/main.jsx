import "./storage-shim.js";
import "./api-patch.js";
import React from "react";
import ReactDOM from "react-dom/client";
import Lyra from "./lyra.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Lyra />
  </ErrorBoundary>
);
