// BRIEF-116 / §127 — the ONE Blob+anchor download path (SSoT: the take-home export AND
// DataExport's JSON backup both call this; no second copy). A pure DOM side-effect; it
// must never throw into the caller's never-stuck flow (#7), so it is wrapped by callers.
export function downloadBlob(filename, text, mime = "text/html;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;               // iOS-Safari quirk is an operator manual check (D-O5)
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
