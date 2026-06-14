import { useState, useEffect, useRef } from "react";
import { COLORS } from "../constants.js";
import { mono } from "./XRayView.jsx";
import { isLookableWord, lookupWord, buildConceptFromWord, normWord } from "../word-dictionary.js";

/**
 * Tap-to-define dictionary. One document-level selection listener covers the
 * whole app: when the student selects a single English word (double-tap or
 * long-press — the native mobile gestures), a small 📖 bubble appears above
 * it; tapping the bubble opens a bilingual definition card (cache-first, one
 * Lite call per word ever). No per-render-site wiring needed.
 */
// Pure positioning — exported for tests. `anchor` is the selection rect's
// bottom-centre {x, yBottom}. Both sit BELOW the selection (the native iOS/
// Android selection menu renders ABOVE it — §24) and are clamped on-screen
// against the given viewport. vw/vh come from visualViewport at the call site.
export function bubblePosition(anchor, vw, vh) {
  return {
    top: Math.min(vh - 48, anchor.yBottom + 10),
    left: Math.min(Math.max(8, anchor.x - 60), vw - 130),
  };
}
export function cardPosition(anchor, vw, vh) {
  return {
    top: Math.min(Math.max(12, anchor.yBottom + 12), Math.max(12, vh - 260)),
    left: Math.min(Math.max(12, anchor.x - 150), Math.max(12, vw - 312)),
  };
}

export default function WordLookup({ trackCall }) {
  const [bubble, setBubble] = useState(null); // { word, sentence, x, y }
  const [popup, setPopup] = useState(null);   // { word, sentence, x, y }
  const [state, setState] = useState({ status: "idle", entry: null });
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef(null);
  const popupOpenRef = useRef(false);
  popupOpenRef.current = !!popup;
  // Touch handoff guards. On mobile the tap that REACHES the bubble collapses
  // the selection (fires selectionchange) and can fire scroll/resize — all of
  // which used to tear the bubble down before the tap landed. bubbleShownAtRef
  // timestamps when a bubble was shown so the collapse/scroll teardown is
  // suppressed for a short grace window; openingRef is true from the first
  // touch on the bubble until the card mounts.
  const bubbleShownAtRef = useRef(0);
  const openingRef = useRef(false);
  const openTimerRef = useRef(null);
  const dismissTimerRef = useRef(null);
  const COLLAPSE_DISMISS_MS = 800; // grace AFTER the selection collapses (tap moment)
  const SCROLL_GRACE_MS = 350;

  // ── selection watcher ──
  useEffect(() => {
    const onSelectionChange = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (popupOpenRef.current) return; // don't fight the open card
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          // B FIX: the touch that reaches the 📖 bubble collapses the selection.
          // Don't tear the bubble down mid-handoff. If a tap is in flight, keep
          // it. Otherwise DEFER the dismissal ~800ms FROM THIS COLLAPSE (the tap
          // moment) — not from when the bubble was shown — so a slow reacher,
          // and the iOS "first tap eaten by the OS" retry, still land on the
          // bubble. A real tap (openingRef) or a new selection cancels it.
          if (openingRef.current) return;
          clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = setTimeout(() => {
            if (!openingRef.current && !popupOpenRef.current) setBubble(null);
          }, COLLAPSE_DISMISS_MS);
          return;
        }
        clearTimeout(dismissTimerRef.current); // a fresh valid selection — keep it
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
        // Anchor BELOW the selection: iOS/Android native selection menus render
        // above it, so a bubble up there gets buried on the primary platform.
        bubbleShownAtRef.current = Date.now();
        setBubble({ word: text, sentence, x: rect.left + rect.width / 2, yBottom: rect.bottom });
      }, 250);
    };
    // D FIX: on a long article the text scrolls in an inner overflow container
    // and a tap-induced finger drift fires scroll mid-handoff. Keep §24
    // "scroll hides a stale bubble" for genuine later scrolls, but don't tear
    // the bubble down during the open gesture / grace window / on our own UI.
    const onScroll = (e) => {
      if (popupOpenRef.current || openingRef.current) return;
      const t = e && e.target;
      if (t && t.closest && t.closest("[data-word-lookup]")) return;
      if (Date.now() - bubbleShownAtRef.current < SCROLL_GRACE_MS) return;
      setBubble(null);
    };
    // D FIX: the mobile URL/toolbar collapse changes innerHeight and fired this
    // unconditionally, wiping the bubble mid-handoff. Dismiss only on a real
    // WIDTH change (rotation always changes width) so §24 rotation-dismiss is
    // preserved while the height-only reflow is ignored. Stays synchronous so
    // stale fixed coords are invalidated immediately on rotation.
    let lastW = typeof window !== "undefined" ? window.innerWidth : 0;
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      setBubble(null); setPopup(null); setState({ status: "idle", entry: null });
    };
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(debounceRef.current);
      clearTimeout(openTimerRef.current);
      clearTimeout(dismissTimerRef.current);
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // ── fetch when the popup opens (or on retry) ──
  useEffect(() => {
    if (!popup) return;
    let alive = true;
    setState({ status: "loading", entry: null });
    lookupWord({ word: popup.word, sentence: popup.sentence }, { trackCall })
      .then(entry => {
        if (!alive) return;
        setState({ status: "loaded", entry });
        try {
          const concepts = JSON.parse(localStorage.getItem("lyra-saved-concepts") || "[]");
          setSaved(concepts.some(c => c.wordKey === normWord(popup.word)));
        } catch (e) { setSaved(false); }
      })
      .catch(() => { if (alive) setState({ status: "error", entry: null }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup, attempt]);

  // First touch on the bubble claims the gesture: openingRef suppresses the
  // selection-collapse / scroll teardown so the button survives until the tap
  // opens it. A backstop timer clears openingRef if the gesture is dropped
  // (finger lifts off the button) so a later deselect can still dismiss.
  const claimBubbleGesture = (e) => {
    openingRef.current = true;
    if (e && e.cancelable) e.preventDefault();
    if (e) e.stopPropagation();
    clearTimeout(openTimerRef.current);
    openTimerRef.current = setTimeout(() => { openingRef.current = false; }, 1500);
  };
  // Opens on pointerup / touchend / mousedown — idempotent (the captured word
  // lives in `bubble`; once consumed, later fires no-op). Never re-reads the
  // selection (it has collapsed by now on mobile).
  const openPopup = (e) => {
    if (e) { if (e.cancelable) e.preventDefault(); e.stopPropagation(); }
    clearTimeout(openTimerRef.current);
    clearTimeout(dismissTimerRef.current);
    if (!bubble) { openingRef.current = false; return; }
    setPopup(bubble);
    setBubble(null);
    openingRef.current = false;
    try { window.getSelection().removeAllRanges(); } catch (err) { /* silent */ }
  };
  const close = () => { clearTimeout(openTimerRef.current); clearTimeout(dismissTimerRef.current); openingRef.current = false; setPopup(null); setState({ status: "idle", entry: null }); setSaved(false); };

  // Save the looked-up word to Saved Concepts (the Saved tab), deduped by word.
  const handleSaveWord = () => {
    if (saved || !state.entry || !popup) return;
    try {
      const concepts = JSON.parse(localStorage.getItem("lyra-saved-concepts") || "[]");
      const record = buildConceptFromWord(state.entry, { sentence: popup.sentence });
      if (!concepts.some(c => c.wordKey === record.wordKey)) {
        concepts.push(record);
        localStorage.setItem("lyra-saved-concepts", JSON.stringify(concepts));
      }
      setSaved(true);
      // Let StyleLab refresh its "Saved (N)" badge (WordLookup lives outside it).
      try { window.dispatchEvent(new Event("lyra-concepts-changed")); } catch (e) { /* silent */ }
    } catch (e) { /* silent */ }
  };

  // Use the visual viewport so coords match what's actually rendered on mobile.
  // Pinch-zoom is disabled app-wide (index.html user-scalable=no), so offsetTop
  // is ~0 — we deliberately do NOT subtract it (that would push the bubble up
  // into the native selection menu, the §24 trap).
  const vvp = (typeof window !== "undefined" && window.visualViewport) || null;
  const vw = vvp ? vvp.width : (typeof window !== "undefined" ? window.innerWidth : 360);
  const vh = vvp ? vvp.height : (typeof window !== "undefined" ? window.innerHeight : 640);

  // On-device diagnostics (phones often have no devtools). Enable by visiting
  // ?wldebug=1 — the overlay shows whether selection→bubble fired (rules A
  // in/out), the bubble coords (C), and whether the tap opened the card (B).
  const debug = (() => {
    try { return new URLSearchParams(window.location.search).get("wldebug") === "1" || localStorage.getItem("lyra-wl-debug") === "1"; }
    catch (e) { return false; }
  })();

  return (
    <>
      {debug && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, background: "rgba(0,0,0,0.82)", color: "#5f5", font: "10px/1.4 monospace", padding: "4px 6px", pointerEvents: "none", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {`WL · bubble=${bubble ? `${bubble.word}@(${Math.round(bubble.x)},${Math.round(bubble.yBottom)})` : "—"} · popup=${popup ? popup.word : "—"} · status=${state.status} · opening=${openingRef.current} · vw=${Math.round(vw)} vh=${Math.round(vh)}`}
        </div>
      )}

      {/* 📖 bubble above the selected word */}
      {bubble && !popup && (
        <button
          data-word-lookup="bubble"
          onPointerDown={claimBubbleGesture}
          onPointerUp={openPopup}
          onTouchEnd={openPopup}
          onMouseDown={openPopup}
          style={{
            position: "fixed",
            ...bubblePosition(bubble, vw, vh),
            zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            minWidth: 44, minHeight: 44,
            padding: "6px 12px", borderRadius: 16,
            border: `1.5px solid ${COLORS.border}`, background: COLORS.heading, color: "#fff",
            fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            // Touch ergonomics: no 300ms delay / double-tap-zoom on the button,
            // and the button's own glyph isn't treated as selectable text (so a
            // tap on it can't be re-read as a new selection gesture).
            touchAction: "manipulation",
            WebkitUserSelect: "none", userSelect: "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          📖 {bubble.word}
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
              ...cardPosition(popup, vw, vh),
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
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.heading }}>{popup.word.toLowerCase()}</span>
                {state.entry && (state.entry.pos_en || state.entry.pos_zh) && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.blue, border: `1px solid ${COLORS.blue}`, borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap", letterSpacing: 0.3 }}>
                    {[state.entry.pos_en, state.entry.pos_zh].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {state.status === "loaded" && state.entry && (
                  <button
                    onClick={handleSaveWord}
                    disabled={saved}
                    style={{ fontSize: 10, fontFamily: mono, padding: "3px 9px", borderRadius: 8, border: `1px solid ${saved ? COLORS.accent1 : COLORS.border}`, background: saved ? "#F0EDE8" : COLORS.card, color: saved ? COLORS.accent1 : COLORS.muted, cursor: saved ? "default" : "pointer", whiteSpace: "nowrap" }}
                  >
                    {saved ? "★ Saved · 已儲存" : "☆ Save · 儲存"}
                  </button>
                )}
                <button onClick={close} aria-label="close" style={{ border: "none", background: "transparent", color: COLORS.muted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </div>
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
