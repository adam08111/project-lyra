import { useState, useEffect, useRef } from "react";
import { COLORS } from "../constants.js";
import { mono } from "./XRayView.jsx";
import { isLookableWord, lookupWord, buildConceptFromWord, normWord } from "../word-dictionary.js";
import { synthesizeSpeech } from "../api.js";
import { getRouteConfig } from "../ai-router.js";

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
// cardW is the ACTUAL (border-box) card width. Clamp BOTH edges to a 16px screen
// gutter: left ≥ 16 and right = left + cardW ≤ vw − 16. §40: widened from 12→16 so
// the card (and the × in its right padding) sits further from the phone edge — the
// 12px gutter left the × ~19px from the edge, inside the iOS back-swipe zone.
export function cardPosition(anchor, vw, vh, cardW) {
  const w = Math.max(0, cardW || 0);
  const left = Math.min(Math.max(16, anchor.x - w / 2), Math.max(16, vw - 16 - w));
  const top = Math.min(Math.max(12, anchor.yBottom + 12), Math.max(12, vh - 260));
  return { top, left, width: w };
}

// Speak a word in a chosen accent via the browser's Speech Synthesis (no API, no
// key, works on the HTTPS deploy AND on http LAN-IP phone testing — speechSynthesis
// isn't gated to secure contexts). lang "en-GB" / "en-US" selects the accent; we
// also try to pin a matching voice when the browser has enumerated them.
function speakWord(text, lang) {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    synth.cancel(); // stop any in-progress utterance
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = lang;
    u.rate = 0.9;
    // DETERMINISTIC voice pick (the "sometimes man / sometimes woman" bug was the
    // browser's default voice varying with getVoices() load timing): prefer an
    // EXACT accent match (en-GB vs en-US → genuinely different), else same-language,
    // and always sort by name so the same accent yields the same voice every time.
    const norm = (l) => (l || "").replace("_", "-").toLowerCase();
    const voices = (synth.getVoices() || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const exact = voices.find(v => norm(v.lang) === norm(lang));
    const sameLang = voices.find(v => norm(v.lang).startsWith(lang.slice(0, 2).toLowerCase()));
    const v = exact || sameLang;
    if (v) u.voice = v;
    synth.speak(u);
  } catch (e) { /* silent — TTS unavailable on this device */ }
}

// Real recorded US/UK pronunciations (+ per-accent IPA) from the free Dictionary
// API (no key). Device TTS often has only one English voice, so US and UK sounded
// identical — recorded audio makes them genuinely differ. Cached per word; on any
// miss/offline the caller falls back to TTS + the AI's IPA.
const pronCache = new Map();
async function fetchPronunciation(word) {
  const w = (word || "").toLowerCase().trim();
  if (!w) return null;
  if (pronCache.has(w)) return pronCache.get(w);
  let result = null;
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
    if (res.ok) {
      const data = await res.json();
      const ph = (Array.isArray(data) ? data : []).flatMap(e => e.phonetics || []);
      // audio urls look like word-us.mp3 / word-1-uk.mp3 — match the accent suffix.
      const byAccent = (sfx) => ph.find(p => p.audio && new RegExp(`-${sfx}\\.mp3$`, "i").test(p.audio));
      const us = byAccent("us"), uk = byAccent("uk");
      const anyIpa = (ph.find(p => p.text && p.text.trim()) || {}).text || "";
      result = {
        audioUs: us?.audio || "",
        audioUk: uk?.audio || "",
        ipaUs: (us?.text || anyIpa || "").trim(),
        ipaUk: (uk?.text || anyIpa || "").trim(),
      };
    }
  } catch (e) { /* offline / not found — caller falls back to TTS + AI IPA */ }
  pronCache.set(w, result);
  return result;
}

// Browsers can't play raw PCM — wrap Gemini's s16le PCM (base64) in a minimal WAV
// container so a plain <audio>/Audio() can play it. Pure; exported for tests.
export function pcm16ToWavBlob(base64Pcm, sampleRate = 24000, channels = 1) {
  const pcm = Uint8Array.from(atob(base64Pcm), (c) => c.charCodeAt(0));
  const blockAlign = channels * 2, byteRate = sampleRate * blockAlign;
  const buf = new ArrayBuffer(44 + pcm.length), view = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, "RIFF"); view.setUint32(4, 36 + pcm.length, true); wr(8, "WAVE");
  wr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true); view.setUint16(34, 16, true);
  wr(36, "data"); view.setUint32(40, pcm.length, true);
  new Uint8Array(buf, 44).set(pcm);
  return new Blob([buf], { type: "audio/wav" });
}

// Native Gemini TTS is the PRIMARY 🔊 source (server-side synth → not hostage to the
// phone's installed voices). Cache the playable blob URL per word|accent for the
// SESSION (in memory only — PCM blobs blow localStorage's 5MB cap, decision §94);
// each uncached word+accent is a full LLM call, so synthesize it once. One in-flight
// promise per key so a double-tap doesn't double-bill. Capped + oldest-revoked.
const ttsUrlCache = new Map();
const ttsInflight = new Map();
const TTS_CACHE_MAX = 100;
function getTtsAudioUrl(word, accent) {
  const key = `${normWord(word)}|${accent}`;
  if (ttsUrlCache.has(key)) return Promise.resolve(ttsUrlCache.get(key));
  if (ttsInflight.has(key)) return ttsInflight.get(key);
  const p = (async () => {
    const { audioBase64, sampleRate } = await synthesizeSpeech({ word, accent, model: getRouteConfig("tts").model });
    const url = URL.createObjectURL(pcm16ToWavBlob(audioBase64, sampleRate));
    if (ttsUrlCache.size >= TTS_CACHE_MAX) {
      const oldest = ttsUrlCache.keys().next().value;
      try { URL.revokeObjectURL(ttsUrlCache.get(oldest)); } catch (e) { /* silent */ }
      ttsUrlCache.delete(oldest);
    }
    ttsUrlCache.set(key, url);
    return url;
  })();
  ttsInflight.set(key, p);
  p.then(() => ttsInflight.delete(key), () => ttsInflight.delete(key));
  return p;
}

export default function WordLookup({ trackCall }) {
  const [bubble, setBubble] = useState(null); // { word, sentence, x, y }
  const [popup, setPopup] = useState(null);   // { word, sentence, x, y }
  const [state, setState] = useState({ status: "idle", entry: null });
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(false);
  const [pron, setPron] = useState(null); // real recorded US/UK audio + IPA (Dictionary API)
  const [synthing, setSynthing] = useState(null); // "uk"|"us"|null — Gemini TTS in flight for this accent
  const audioRef = useRef({ uk: null, us: null }); // preloaded <audio> fallback so a tap plays inside the gesture
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

  // Fetch real recorded US/UK pronunciations for the open word (best-effort).
  useEffect(() => {
    if (!popup) { setPron(null); return; }
    let alive = true;
    setPron(null);
    fetchPronunciation(popup.word).then(p => { if (alive) setPron(p); });
    return () => { alive = false; };
  }, [popup]);

  // Prime the speech voices on mount. getVoices() is [] until the engine fires
  // "voiceschanged" (async) — speaking before then pins NO voice, so the browser
  // uses its single default (ignoring u.lang for accent) → US and UK sound the
  // same and the voice varies with load timing ("sometimes man, sometimes woman").
  // Touching getVoices() early kicks off the load so it's populated by the first tap.
  useEffect(() => {
    const synth = typeof window !== "undefined" && window.speechSynthesis;
    if (!synth) return;
    const prime = () => { try { synth.getVoices(); } catch (e) { /* silent */ } };
    prime();
    synth.addEventListener?.("voiceschanged", prime);
    return () => synth.removeEventListener?.("voiceschanged", prime);
  }, []);

  // Preload the recordings into <audio> elements as soon as they're known, so a tap
  // PLAYS them synchronously inside the user-gesture. iOS blocks Audio.play() that
  // runs AFTER an await (§92.2's on-demand fetch tripped exactly that — the real
  // recording was dropped and the flaky TTS surfaced, even for words that HAD a US
  // recording). Buffered here → instant, gesture-safe on tap.
  useEffect(() => {
    const mk = (url) => {
      if (!url || typeof Audio === "undefined") return null;
      const a = new Audio(url); a.preload = "auto";
      try { a.load(); } catch (e) { /* silent */ }
      return a;
    };
    audioRef.current = { uk: mk(pron?.audioUk), us: mk(pron?.audioUs) };
    return () => {
      const { uk, us } = audioRef.current;
      [uk, us].forEach(a => { if (a) { try { a.pause(); } catch (e) { /* silent */ } } });
      audioRef.current = { uk: null, us: null };
    };
  }, [pron]);

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

  // Trap-proofing: Escape closes the card (desktop). The backdrop tap (below)
  // is the mobile exit; the viewport-fit card keeps the × reachable as a third.
  useEffect(() => {
    if (!popup) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup]);

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

  // Fallback when Gemini TTS is unavailable (never-stuck, #7): the §93 preloaded
  // dictionaryapi recording, then the browser TTS. Stays inside the gesture.
  const playRecordingOrTts = (accent, word, lang) => {
    const el = accent === "uk" ? audioRef.current.uk : audioRef.current.us;
    if (el) {
      try {
        el.currentTime = 0;
        const r = el.play();
        if (r && typeof r.catch === "function") r.catch(() => speakWord(word, lang));
        return;
      } catch (e) { /* fall through to TTS */ }
    }
    speakWord(word, lang);
  };

  // Play the accent's pronunciation. PRIMARY: native Gemini TTS (server-side synth →
  // genuinely accented, not hostage to the phone's installed voices). Cached audio
  // plays instantly IN the gesture; an uncached word is synthesized (spinner) then
  // played — the await breaks the iOS gesture only on the FIRST tap of a word, after
  // which it's cached and instant (the §92.2 lesson: cache, don't preload-race).
  // Layered fallback keeps 🔊 never-stuck: Gemini fails → recording → browser TTS.
  const playPron = async (accent) => {
    const word = state.entry?.word || popup?.word;
    const lang = accent === "uk" ? "en-GB" : "en-US";
    if (!word) return;
    const playUrl = (url) => {
      try {
        const a = new Audio(url);
        const r = a.play();
        if (r && typeof r.catch === "function") r.catch(() => playRecordingOrTts(accent, word, lang));
      } catch (e) { playRecordingOrTts(accent, word, lang); }
    };
    // Cached Gemini audio → play immediately, inside the gesture.
    const key = `${normWord(word)}|${accent}`;
    if (ttsUrlCache.has(key)) { playUrl(ttsUrlCache.get(key)); return; }
    // Uncached → synthesize (spinner), then play; on any error, fall back.
    setSynthing(accent);
    try {
      const url = await getTtsAudioUrl(word, accent);
      playUrl(url);
    } catch (e) {
      playRecordingOrTts(accent, word, lang);
    } finally {
      setSynthing(s => (s === accent ? null : s));
    }
  };

  // Use the visual viewport so coords match what's actually rendered on mobile.
  // Pinch-zoom is disabled app-wide (index.html user-scalable=no), so offsetTop
  // is ~0 — we deliberately do NOT subtract it (that would push the bubble up
  // into the native selection menu, the §24 trap).
  const vvp = (typeof window !== "undefined" && window.visualViewport) || null;
  const vw = vvp ? vvp.width : (typeof window !== "undefined" ? window.innerWidth : 360);
  const vh = vvp ? vvp.height : (typeof window !== "undefined" ? window.innerHeight : 640);
  // Card width: cap at 360 but NEVER exceed the viewport minus a 16px gutter
  // each side (§40). With box-sizing:border-box this IS the rendered width.
  const cardW = Math.min(360, vw - 32);

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
              boxSizing: "border-box", // width INCLUDES padding+border — so it actually fits
              ...cardPosition(popup, vw, vh, cardW),
              maxWidth: "calc(100vw - 32px)",
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
                {/* §40: un-tuck from the corner. §39's negative margins (marginRight:-8/marginTop:-10)
                    pinned the × right-edge ~19px from the screen edge — inside the iOS back-swipe zone and
                    unreachable by finger on a real phone. Now a visible, bordered 44×44 button that sits
                    INSIDE the card padding (right edge ~26px from the screen edge, centre ~48px), so it
                    reads as a real button and clears the edge gesture zone. */}
                <button onClick={close} aria-label="close" style={{ border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.heading, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 0, minWidth: 44, minHeight: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, touchAction: "manipulation" }}>×</button>
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
                {/* Pronunciation — UK + US accent. Tap 🔊 to hear it (native Gemini TTS,
                    server-synthesized; ⏳ while it synthesizes the first time). The IPA
                    is shown when the lookup provided it. */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  {[
                    { lab: "UK", accent: "uk", ipa: (pron?.ipaUk || state.entry.ipa_uk || "") },
                    { lab: "US", accent: "us", ipa: (pron?.ipaUs || state.entry.ipa_us || "") },
                  ].map(p => (
                    <button
                      key={p.lab}
                      onClick={() => playPron(p.accent)}
                      disabled={synthing === p.accent}
                      title={`Play the ${p.lab} pronunciation`}
                      aria-label={`Play the ${p.lab} pronunciation of ${popup.word}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: mono, fontSize: 11, padding: "3px 9px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.heading, cursor: synthing === p.accent ? "default" : "pointer", opacity: synthing === p.accent ? 0.7 : 1, touchAction: "manipulation" }}
                    >
                      <span style={{ fontWeight: 700, color: COLORS.blue }}>{p.lab}</span>
                      {p.ipa && <span style={{ color: COLORS.muted }}>{/^[/[]/.test(p.ipa.trim()) ? p.ipa.trim() : `/${p.ipa.trim()}/`}</span>}
                      <span aria-hidden="true">{synthing === p.accent ? "⏳" : "🔊"}</span>
                    </button>
                  ))}
                </div>
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
