import { useState, useEffect, useRef } from "react";
import { COLORS } from "../constants.js";
import { mono } from "./XRayView.jsx";
import { isLookableWord, lookupWord } from "../word-dictionary.js";

/**
 * Tap-to-define dictionary. One document-level selection listener covers the
 * whole app: when the student selects a single English word (double-tap or
 * long-press — the native mobile gestures), a small 📖 bubble appears above
 * it; tapping the bubble opens a bilingual definition card (cache-first, one
 * Lite call per word ever). No per-render-site wiring needed.
 */
export default function WordLookup({ trackCall }) {
  const [bubble, setBubble] = useState(null); // { word, sentence, x, y }
  const [popup, setPopup] = useState(null);   // { word, sentence, x, y }
  const [state, setState] = useState({ status: "idle", entry: null });
  const [attempt, setAttempt] = useState(0);
  const debounceRef = useRef(null);
  const popupOpenRef = useRef(false);
  popupOpenRef.current = !!popup;

  // ── selection watcher ──
  useEffect(() => {
    const onSelectionChange = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (popupOpenRef.current) return; // don't fight the open card
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setBubble(null); return; }
        const text = sel.toString().trim();
        if (!isLookableWord(text)) { setBubble(null); return; }
        // Ignore selections inside editors or our own UI
        const node = sel.anchorNode;
        const el = node && (node.nodeType === 1 ? node : node.parentElement);
        if (!el || el.closest("input, textarea, [contenteditable], [data-word-lookup]")) { setBubble(null); return; }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) { setBubble(null); return; }
        // Context: ±120 chars of the text node around the selection
        const full = (node.textContent || "");
        const at = Math.max(0, (sel.getRangeAt(0).startOffset || 0) - 120);
        const sentence = full.slice(at, (sel.getRangeAt(0).startOffset || 0) + text.length + 120).trim();
        setBubble({ word: text, sentence, x: rect.left + rect.width / 2, y: rect.top });
      }, 250);
    };
    const onScroll = () => { if (!popupOpenRef.current) setBubble(null); };
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      clearTimeout(debounceRef.current);
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  // ── fetch when the popup opens (or on retry) ──
  useEffect(() => {
    if (!popup) return;
    let alive = true;
    setState({ status: "loading", entry: null });
    lookupWord({ word: popup.word, sentence: popup.sentence }, { trackCall })
      .then(entry => { if (alive) setState({ status: "loaded", entry }); })
      .catch(() => { if (alive) setState({ status: "error", entry: null }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup, attempt]);

  const openPopup = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!bubble) return;
    setPopup(bubble);
    setBubble(null);
    try { window.getSelection().removeAllRanges(); } catch (err) { /* silent */ }
  };
  const close = () => { setPopup(null); setState({ status: "idle", entry: null }); };

  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  const vh = typeof window !== "undefined" ? window.innerHeight : 640;

  return (
    <>
      {/* 📖 bubble above the selected word */}
      {bubble && !popup && (
        <button
          data-word-lookup="bubble"
          onPointerDown={openPopup}
          onMouseDown={openPopup}
          style={{
            position: "fixed",
            top: Math.max(8, bubble.y - 44),
            left: Math.min(Math.max(8, bubble.x - 60), vw - 130),
            zIndex: 200,
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 16,
            border: `1.5px solid ${COLORS.border}`, background: COLORS.heading, color: "#fff",
            fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
          }}
        >
          📖 {bubble.word} · 中文?
        </button>
      )}

      {/* definition card */}
      {popup && (
        <>
          <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(0,0,0,0.08)" }} />
          <div
            data-word-lookup="card"
            style={{
              position: "fixed",
              zIndex: 200,
              top: Math.min(Math.max(12, popup.y + 16), vh - 260),
              left: Math.min(Math.max(12, popup.x - 150), Math.max(12, vw - 312)),
              width: Math.min(300, vw - 24),
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderLeft: `3px solid ${COLORS.blue}`,
              borderRadius: 14,
              padding: "12px 14px",
              fontFamily: mono,
              boxShadow: "0 8px 28px rgba(0,0,0,0.16)",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.heading }}>{popup.word.toLowerCase()}</span>
                {state.entry && (state.entry.pos_en || state.entry.pos_zh) && (
                  <span style={{ fontSize: 10, color: COLORS.muted, whiteSpace: "nowrap" }}>
                    {[state.entry.pos_en, state.entry.pos_zh].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              <button onClick={close} aria-label="close" style={{ border: "none", background: "transparent", color: COLORS.muted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {state.status === "loading" && (
              <div style={{ fontSize: 11, color: COLORS.muted }}>查字典中… <span style={{ opacity: 0.6 }}>Looking it up…</span></div>
            )}
            {state.status === "error" && (
              <div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>查不到 — 請再試一次。 <span style={{ opacity: 0.7 }}>Couldn't look it up — try again.</span></div>
                <button onClick={() => setAttempt(a => a + 1)} style={{ fontSize: 11, fontFamily: mono, padding: "4px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.heading, cursor: "pointer" }}>↻ Retry</button>
              </div>
            )}
            {state.status === "loaded" && state.entry && (
              <>
                {state.entry.zh && <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.blue, marginBottom: 4 }}>{state.entry.zh}</div>}
                {state.entry.meaning_en && <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7 }}>{state.entry.meaning_en}</div>}
                {state.entry.meaning_zh && <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.7, marginTop: 2 }}>{state.entry.meaning_zh}</div>}
                {(state.entry.example_en || state.entry.example_zh) && (
                  <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#A6701F", letterSpacing: 0.5, marginBottom: 2 }}>For example · 例如</div>
                    {state.entry.example_en && <div style={{ fontSize: 11, lineHeight: 1.6 }}>{state.entry.example_en}</div>}
                    {state.entry.example_zh && <div style={{ fontSize: 11, lineHeight: 1.6, marginTop: 2, opacity: 0.85 }}>{state.entry.example_zh}</div>}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
