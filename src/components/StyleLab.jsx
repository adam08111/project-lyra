import { useState, useRef, useEffect, useCallback } from "react";
import { groupAchievements } from "../report-utils.js";
import { toWrittenChinese } from "../zh-register.js";
import { loadTrainingChats, countThreadTurns } from "../training-threads.js";
import GrowthReport from "./GrowthReport.jsx";
import { COLORS, defaultXraySections } from "../constants.js";
import { sharedStyles as s } from "../styles.js";
import { callAI } from "../api.js";
import { getRouteConfig } from "../ai-router.js";
import { buildStyleProfilerPrompt, translatePrompt, XRAY_ALL_SECTIONS } from "../prompts.js";
import { stripLearningData } from "../learning-sync.js";
import { FeatherIcon } from "./Icons.jsx";
import XRayView, {
  parseProfileSections, filterSectionsToRequested, parseSectionContent, parseAnnotations,
  labelColorIndex, ANNOTATION_COLORS, AnnotatedQuote, SectionCard,
  extractAuthor, saveStyleSkill, mono, parseStructureContent,
  deriveShortTitle, translateWithGuard, AnalyseMoreButton, remainingSections, loadSavedSkill
} from "./XRayView.jsx";


// parseProfileSections, parseSectionContent, parseAnnotations, ANNOTATION_COLORS,
// labelColorIndex, AnnotatedQuote, SectionCard, extractAuthor, saveStyleSkill, mono
// are all imported from XRayView.jsx above

// Build a structured text payload for the translator and parse the response per slot
function buildConceptTranslateInput(c) {
  const parts = [];
  if (c.grammar)  parts.push(`GRAMMAR: ${c.grammar}`);
  if (c.function) parts.push(`FUNCTION: ${c.function}`);
  if (c.useIt)    parts.push(`USE IT: ${c.useIt}`);
  if (c.example)  parts.push(`FROM THE TEXT: ${c.example}`);
  return parts.join("\n\n");
}

function parseConceptTranslation(result) {
  if (!result) return {};
  // Collect EN/ZH pairs first
  const pairs = result
    .split(/\n\s*\n/)
    .map(b => b.trim())
    .filter(Boolean)
    .map(b => {
      const enMatch = b.match(/^EN:\s*(.+?)(?:\n|$)/s);
      const zhMatch = b.match(/ZH:\s*(.+)$/s);
      return { en: enMatch?.[1]?.trim() || "", zh: zhMatch?.[1]?.trim() || "" };
    });

  // Expanded Chinese label dictionary (matches what XRayView accepts)
  const zhLabels = {
    grammar:  /^(文法|語法|文法模式|語法模式|文法結構|語法結構|句法|句子結構)[:：]/,
    function: /^(功能|作用|目的|用途|效用|效果)[:：]/,
    useIt:    /^(試著使用|試試看|試試|嘗試一下|請試試|練習|自己試試|動手試試|試著套用|嘗試套用|套用練習|套用模板|套用方法|來試試|你也試試|你來試試)[:：]/,
    example:  /^(文中引述|文中例子|文中範例|原文引述|原文範例|引文|引述|範例|原文)[:：]/,
  };
  const stripPrefix = (zh) =>
    zh.replace(/^(文法|語法|文法模式|語法模式|文法結構|句法|功能|作用|目的|用途|效用|試著使用|試試看|試試|嘗試一下|練習|套用練習|套用模板|文中引述|文中例子|文中範例|原文引述|引文|引述|範例|原文)[:：]\s*/, "").trim();

  const slots = { grammar: "", function: "", useIt: "", example: "" };

  // Pass 1: route by explicit label (English-side preferred, Chinese-side fallback)
  for (const p of pairs) {
    let key = null;
    if (/^GRAMMAR\b/i.test(p.en)) key = "grammar";
    else if (/^FUNCTION\b/i.test(p.en)) key = "function";
    else if (/^USE\s+IT\b/i.test(p.en)) key = "useIt";
    else if (/^FROM\s+THE\s+TEXT\b/i.test(p.en)) key = "example";
    else if (zhLabels.grammar.test(p.zh)) key = "grammar";
    else if (zhLabels.function.test(p.zh)) key = "function";
    else if (zhLabels.useIt.test(p.zh)) key = "useIt";
    else if (zhLabels.example.test(p.zh)) key = "example";
    if (key && !slots[key]) {
      slots[key] = stripPrefix(p.zh);
    }
  }

  // Pass 2: positional fallback — fill empty slots in source order
  // (input was built as GRAMMAR → FUNCTION → USE IT → FROM THE TEXT, so pairs follow that order)
  const order = ["grammar", "function", "useIt", "example"];
  const unrouted = pairs.filter(p => {
    const allRegexes = Object.values(zhLabels);
    const enRouted = /^(GRAMMAR|FUNCTION|USE\s+IT|FROM\s+THE\s+TEXT)\b/i.test(p.en);
    const zhRouted = allRegexes.some(re => re.test(p.zh));
    return !enRouted && !zhRouted && p.zh;
  });
  let unroutedIdx = 0;
  for (const slot of order) {
    if (!slots[slot] && unrouted[unroutedIdx]) {
      slots[slot] = stripPrefix(unrouted[unroutedIdx].zh);
      unroutedIdx++;
    }
  }

  return slots;
}

function SavedConceptCard({ concept, isExpanded, onToggle, onRemove }) {
  const [translation, setTranslation] = useState(null); // { grammar, function, useIt, example }
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);

  // Dictionary words (saved from the tap-to-define popup) are already fully
  // bilingual and have their own fields — render a dedicated compact card
  // (no translate button needed).
  if (concept.kind === "word") {
    const w = concept;
    return (
      <div style={{ background: COLORS.card, borderTop: `1px solid ${isExpanded ? COLORS.blue : COLORS.border}`, borderRight: `1px solid ${isExpanded ? COLORS.blue : COLORS.border}`, borderBottom: `1px solid ${isExpanded ? COLORS.blue : COLORS.border}`, borderLeft: `3px solid ${COLORS.blue}`, borderRadius: 14, marginBottom: 10, overflow: "hidden", transition: "border-color 0.2s" }}>
        <div onClick={onToggle} style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, fontFamily: mono }}>{w.name}</span>
              {w.pos && <span style={{ fontSize: 9, fontWeight: 700, color: COLORS.blue, border: `1px solid ${COLORS.blue}`, borderRadius: 6, padding: "1px 6px", fontFamily: mono, whiteSpace: "nowrap" }}>{w.pos}</span>}
            </div>
            <div style={{ fontSize: 10, color: COLORS.muted, fontFamily: mono, marginTop: 2 }}>{w.section}</div>
          </div>
          <span style={{ fontSize: 10, color: COLORS.muted, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>&#9654;</span>
        </div>
        {isExpanded && (
          <div style={{ padding: "0 14px 14px", fontFamily: mono }}>
            {w.meaning_en && <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7 }}>{w.meaning_en}</div>}
            {w.meaning_zh && <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.7, marginTop: 2 }}>{w.meaning_zh}</div>}
            {(w.example_en || w.example_zh) && (
              <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#A6701F", letterSpacing: 0.5, marginBottom: 2 }}>For example · 例如</div>
                {w.example_en && <div style={{ fontSize: 11, lineHeight: 1.6 }}>{w.example_en}</div>}
                {w.example_zh && <div style={{ fontSize: 11, lineHeight: 1.6, marginTop: 2, opacity: 0.85 }}>{w.example_zh}</div>}
              </div>
            )}
            {w.example && (
              <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, fontStyle: "italic", marginTop: 8 }}>From: {w.example}</div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              style={{ fontSize: 10, fontFamily: mono, padding: "4px 10px", borderRadius: 8, border: `1px solid ${COLORS.red || "#c44"}`, background: "transparent", color: COLORS.red || "#c44", cursor: "pointer", marginTop: 8 }}
            >
              Remove
            </button>
          </div>
        )}
      </div>
    );
  }

  const handleTranslate = async (e) => {
    e.stopPropagation();
    if (translating) return;
    if (showTranslation) { setShowTranslation(false); return; }
    if (translation) { setShowTranslation(true); return; }
    const input = buildConceptTranslateInput(concept);
    if (!input.trim()) return;
    setTranslating(true);
    try {
      const route = getRouteConfig("translate");
      const result = await callAI(translatePrompt, input, false, 2000, route.thinkingBudget, undefined, undefined, route.model);
      setTranslation(parseConceptTranslation(result || ""));
      setShowTranslation(true);
    } catch (err) {
      setTranslation({ grammar: "翻譯失敗。", function: "", useIt: "", example: "" });
      setShowTranslation(true);
    }
    setTranslating(false);
  };

  const c = concept;
  // Split useIt template + example on arrow
  const splitUseIt = (text) => {
    if (!text) return { template: "", example: "" };
    const m = text.match(/^([\s\S]+?)\s*(?:→|→|->)\s*([\s\S]+)$/);
    return { template: m ? m[1].trim() : text, example: m ? m[2].trim() : "" };
  };
  const enUse = splitUseIt(c.useIt);
  const zhUse = splitUseIt(translation?.useIt || "");

  return (
    <div style={{ background: COLORS.card, borderTop: `1px solid ${isExpanded ? COLORS.accent1 : COLORS.border}`, borderRight: `1px solid ${isExpanded ? COLORS.accent1 : COLORS.border}`, borderBottom: `1px solid ${isExpanded ? COLORS.accent1 : COLORS.border}`, borderLeft: `3px solid ${COLORS.accent1}`, borderRadius: 14, marginBottom: 10, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={onToggle} style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, fontFamily: mono }}>{c.name}</div>
          <div style={{ fontSize: 10, color: COLORS.muted, fontFamily: mono, marginTop: 2 }}>{c.section}</div>
        </div>
        <button
          onClick={(e) => { if (!isExpanded) onToggle(); handleTranslate(e); }}
          disabled={translating}
          style={{ fontSize: 10, fontFamily: mono, padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${COLORS.border}`, background: translating ? "#F0EDE8" : COLORS.card, color: COLORS.heading, cursor: translating ? "default" : "pointer", fontWeight: 600, flexShrink: 0 }}
        >
          {translating ? "翻譯中..." : showTranslation ? "隱藏翻譯" : "翻譯成中文"}
        </button>
        <span style={{ fontSize: 10, color: COLORS.muted, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>&#9654;</span>
      </div>
      {isExpanded && (
        <div style={{ padding: "0 14px 14px", fontFamily: mono }}>
          {c.grammar && (
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 8, background: "#EDE8E0", borderRadius: 8, padding: "8px 10px" }}>
              <span style={{ fontWeight: 700, color: COLORS.heading }}>Grammar pattern: </span>{c.grammar}
              {showTranslation && translation?.grammar && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${COLORS.border}`, color: COLORS.heading }}>
                  <span style={{ fontWeight: 700 }}>文法：</span>{translation.grammar}
                </div>
              )}
            </div>
          )}
          {c.function && (
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 8, background: "#E8E3DB", borderRadius: 8, padding: "8px 10px" }}>
              <span style={{ fontWeight: 700, color: COLORS.heading }}>Why use it: </span>{c.function}
              {showTranslation && translation?.function && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${COLORS.border}`, color: COLORS.heading }}>
                  <span style={{ fontWeight: 700 }}>功能：</span>{translation.function}
                </div>
              )}
            </div>
          )}
          {c.useIt && (
            <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, marginBottom: 8, border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 8, padding: "8px 10px" }}>
              <span style={{ fontWeight: 700, color: COLORS.accent1 }}>Try it yourself: </span>{enUse.template}
              {enUse.example && (
                <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20" }}>
                  <span style={{ fontWeight: 700, color: "#A6701F" }}>For example: </span>{enUse.example}
                </div>
              )}
              {showTranslation && translation?.useIt && (
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px dashed ${COLORS.border}` }}>
                  <span style={{ fontWeight: 700, color: COLORS.accent1 }}>試著使用：</span>{zhUse.template}
                  {zhUse.example && (
                    <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20" }}>
                      <span style={{ fontWeight: 700, color: "#A6701F" }}>例如：</span>{zhUse.example}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {c.example && (
            <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, fontStyle: "italic", marginBottom: 8 }}>
              From: {c.example}
              {showTranslation && translation?.example && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${COLORS.border}`, color: COLORS.heading, fontStyle: "italic" }}>
                  翻譯：{translation.example}
                </div>
              )}
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{ fontSize: 10, fontFamily: mono, padding: "4px 10px", borderRadius: 8, border: `1px solid ${COLORS.red || "#c44"}`, background: "transparent", color: COLORS.red || "#c44", cursor: "pointer" }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

// §44 A–Z index for the Saved tab's WORDS. Bucket the FULL set of saved word
// items (each { name, savedAt }) by first letter: trimmed + uppercased, A–Z → that
// letter, anything else (digit, CJK, punctuation, empty) → "#" so nothing is ever
// dropped. Within a bucket, newest-first (savedAt desc) — a student usually wants
// the word they just saved. Returns the per-letter buckets AND the Set of
// non-empty letters (which greys out the empty chips). Pure — works on the full
// store, never a rendered window. Exported for tests.
const A_Z = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const WORD_WINDOW_STEP = 20;
export function bucketWordsByLetter(words) {
  const buckets = { "#": [] };
  for (const L of A_Z) buckets[L] = [];
  for (const w of (words || [])) {
    const first = String((w && w.name) || "").trim().charAt(0).toUpperCase();
    const key = first >= "A" && first <= "Z" ? first : "#";
    buckets[key].push(w);
  }
  const letters = new Set();
  for (const key of Object.keys(buckets)) {
    buckets[key].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)); // newest-first
    if (buckets[key].length > 0) letters.add(key);
  }
  return { buckets, letters };
}

// §44 Concepts-by-category grouping for the Saved tab. Group saved CONCEPTS by
// their `section` label (the X-Ray section the breakdown came from); concepts with
// no section → "Other". Newest-first within a group (savedAt desc). Returns the
// groups AND an ordered label list: the §13 canonical X-Ray order first
// (XRAY_ALL_SECTIONS), then any other labels alphabetically, "Other" last. Pure;
// full store. Exported for tests.
const CONCEPT_OTHER = "Other";
export function groupConceptsByCategory(concepts, canonicalOrder = XRAY_ALL_SECTIONS) {
  const order0 = canonicalOrder || [];
  const groups = {};
  for (const c of (concepts || [])) {
    const label = (c && c.section && String(c.section).trim()) || CONCEPT_OTHER;
    (groups[label] || (groups[label] = [])).push(c);
  }
  for (const label of Object.keys(groups)) {
    groups[label].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)); // newest-first
  }
  const present = Object.keys(groups);
  const canon = order0.filter((l) => present.includes(l));
  const rest = present.filter((l) => l !== CONCEPT_OTHER && !order0.includes(l)).sort((a, b) => a.localeCompare(b));
  const order = [...canon, ...rest, ...(groups[CONCEPT_OTHER] ? [CONCEPT_OTHER] : [])];
  return { groups, order };
}

// §44 search over saved items (both sections). The searchable blob is the item's
// English term/name plus its meanings/examples; WORDS also carry their Chinese
// (the " · 中文" in `name`, plus meaning_zh / example_zh), so a Chinese query finds
// vocab by 中文. Concepts have no stored Chinese (translated on demand) → English
// only. Case/whitespace-insensitive substring; empty query → true. Pure; exported.
function savedSearchBlob(item) {
  return [item.name, item.name_zh, item.term_zh, item.meaning_en, item.meaning_zh, item.grammar, item.function, item.useIt, item.example, item.example_en, item.example_zh]
    .filter(Boolean).join(" ").toLowerCase();
}
export function matchesSaved(item, query) {
  const q = String(query == null ? "" : query).trim().toLowerCase();
  if (!q) return true;
  return savedSearchBlob(item || {}).includes(q);
}

function SavedConcepts() {
  const [concepts, setConcepts] = useState(() => JSON.parse(localStorage.getItem("lyra-saved-concepts") || "[]"));
  const [expanded, setExpanded] = useState(null);
  const [letter, setLetter] = useState("All");          // A–Z index selection (WORDS only)
  const [wordWindow, setWordWindow] = useState(WORD_WINDOW_STEP);
  const [conceptWindows, setConceptWindows] = useState({}); // per-category load-more (label → shown count)
  const [query, setQuery] = useState("");                   // search — outer filter over BOTH sections
  const [conceptSearchWindow, setConceptSearchWindow] = useState(WORD_WINDOW_STEP);

  const remove = (idx) => {
    const next = concepts.filter((_, i) => i !== idx);
    setConcepts(next);
    localStorage.setItem("lyra-saved-concepts", JSON.stringify(next));
    if (expanded === idx) setExpanded(null);
  };

  if (concepts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <FeatherIcon size={24} color={COLORS.accent2} />
        <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 12, lineHeight: 1.5, fontFamily: mono }}>
          No saved concepts yet. Analyse a passage and tap Save on any grammar breakdown to bookmark it here.
        </div>
      </div>
    );
  }

  // Two kinds of saved resources live here — dictionary words and writing
  // concepts (techniques + grammar patterns). Group them under separate
  // headers so vocab review and concept review don't blur into one list.
  // Indices stay ORIGINAL (into `concepts`) so remove/expand keep working.
  const entries = concepts.map((c, i) => ({ c, i }));
  const words = entries.filter(e => e.c.kind === "word");
  const others = entries.filter(e => e.c.kind !== "word");

  // A–Z index over the WORDS: bucket the FULL set (each item carries the original
  // index `i` so remove/expand still hit the right record), then window the active
  // view. "All" keeps the store order (current behaviour); a letter is newest-first.
  const wordItems = words.map(e => ({ name: e.c.name, savedAt: e.c.savedAt || 0, c: e.c, i: e.i }));
  const { buckets, letters } = bucketWordsByLetter(wordItems);
  const activeWords = letter === "All" ? wordItems : (buckets[letter] || []);
  const shownWords = activeWords.slice(0, wordWindow);
  const selectLetter = (L) => { setLetter(L); setWordWindow(WORD_WINDOW_STEP); };
  const indexChips = ["All", ...A_Z, ...(buckets["#"].length ? ["#"] : [])];

  // Concepts grouped by their X-Ray category (full store), each group windowed —
  // nobody recalls a concept by first letter, so category beats A–Z here.
  const conceptItems = others.map(e => ({ section: e.c.section, savedAt: e.c.savedAt || 0, c: e.c, i: e.i }));
  const { groups: conceptGroups, order: conceptOrder } = groupConceptsByCategory(conceptItems);

  // Search is the OUTER filter: a non-empty query filters the FULL store of BOTH
  // sections and suppresses the A–Z chips + category grouping (flat result lists).
  // Clearing the query restores the browse view to "All" (simplest).
  const searching = query.trim().length > 0;
  const filteredWords = wordItems.filter((it) => matchesSaved(it.c, query));
  const filteredOthers = conceptItems.filter((it) => matchesSaved(it.c, query));
  const onQuery = (v) => {
    setQuery(v);
    setWordWindow(WORD_WINDOW_STEP);
    setConceptSearchWindow(WORD_WINDOW_STEP);
    if (!v.trim()) setLetter("All");
  };
  const showMoreStyle = { width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: mono, fontSize: 12, fontWeight: 700, color: COLORS.heading, cursor: "pointer", marginTop: 4 };
  const noMatchesMsg = (
    <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono, padding: "2px 0 10px" }}>no matches · 沒有符合</div>
  );

  const sectionHeader = (label) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono, margin: "14px 0 8px" }}>
      {label}
    </div>
  );
  const renderCards = (list) => list.map(({ c, i }) => (
    <SavedConceptCard
      key={i}
      concept={c}
      isExpanded={expanded === i}
      onToggle={() => setExpanded(expanded === i ? null : i)}
      onRemove={() => remove(i)}
    />
  ));

  return (
    <div>
      {/* Search — the OUTER filter over BOTH sections (English; words also by 中文).
          A non-empty query suppresses the A–Z chips + category grouping → flat lists. */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search saved · 搜尋"
          aria-label="Search saved words and concepts"
          style={{ width: "100%", boxSizing: "border-box", padding: "9px 32px 9px 12px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: mono, fontSize: 13, color: COLORS.heading, outline: "none" }}
        />
        {query && (
          <button onClick={() => onQuery("")} aria-label="Clear search" style={{ position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)", width: 22, height: 22, borderRadius: 11, border: "none", background: "transparent", color: COLORS.muted, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>&#10005;</button>
        )}
      </div>

      {searching ? (
        <>
          {sectionHeader(`📖 Words · 生字 (${filteredWords.length})`)}
          {filteredWords.length === 0 ? noMatchesMsg : (
            <>
              {renderCards(filteredWords.slice(0, wordWindow))}
              {filteredWords.length > wordWindow && (
                <button onClick={() => setWordWindow((w) => w + WORD_WINDOW_STEP)} style={showMoreStyle}>Show more · 顯示更多 ({filteredWords.length - wordWindow})</button>
              )}
            </>
          )}
          {sectionHeader(`✦ Concepts · 概念 (${filteredOthers.length})`)}
          {filteredOthers.length === 0 ? noMatchesMsg : (
            <>
              {renderCards(filteredOthers.slice(0, conceptSearchWindow))}
              {filteredOthers.length > conceptSearchWindow && (
                <button onClick={() => setConceptSearchWindow((w) => w + WORD_WINDOW_STEP)} style={showMoreStyle}>Show more · 顯示更多 ({filteredOthers.length - conceptSearchWindow})</button>
              )}
            </>
          )}
        </>
      ) : (
        <>
      {words.length > 0 && (
        <>
          {sectionHeader(`📖 Words · 生字 (${words.length})`)}
          {/* A–Z letter index (WORDS only): tap a letter to filter to it; letters
              with no saved word are greyed/disabled; "All" resets; "#" appears only
              when a non-letter first char exists. Buckets the FULL store, then windows. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            {indexChips.map((ch) => {
              const enabled = ch === "All" || letters.has(ch);
              const active = letter === ch;
              return (
                <button
                  key={ch}
                  onClick={() => { if (enabled) selectLetter(ch); }}
                  disabled={!enabled}
                  aria-label={ch === "All" ? "Show all saved words" : `Saved words starting with ${ch}`}
                  style={{
                    minWidth: ch === "All" ? 38 : 26, height: 26, padding: "0 5px", borderRadius: 7,
                    border: `1px solid ${active ? COLORS.heading : COLORS.border}`,
                    background: active ? COLORS.heading : COLORS.card,
                    color: active ? "#fff" : (enabled ? COLORS.heading : COLORS.muted),
                    opacity: enabled ? 1 : 0.3,
                    fontFamily: mono, fontSize: 11, fontWeight: 700,
                    cursor: enabled ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >{ch}</button>
              );
            })}
          </div>
          {renderCards(shownWords)}
          {activeWords.length > shownWords.length && (
            <button
              onClick={() => setWordWindow((w) => w + WORD_WINDOW_STEP)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: mono, fontSize: 12, fontWeight: 700, color: COLORS.heading, cursor: "pointer", marginTop: 4 }}
            >
              Show more · 顯示更多 ({activeWords.length - shownWords.length})
            </button>
          )}
        </>
      )}
      {others.length > 0 && (
        <>
          {sectionHeader(`✦ Concepts · 概念 (${others.length})`)}
          {/* Concepts grouped by their X-Ray category (the section the breakdown came
              from); canonical section order, "Other · 其他" last. Each group windows at
              20 with its own Show-more. */}
          {conceptOrder.map((label) => {
            const list = conceptGroups[label] || [];
            const win = conceptWindows[label] || WORD_WINDOW_STEP;
            const shown = list.slice(0, win);
            return (
              <div key={label} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.accent2, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: mono, margin: "6px 0" }}>
                  {label === CONCEPT_OTHER ? "Other · 其他" : label} ({list.length})
                </div>
                {renderCards(shown)}
                {list.length > shown.length && (
                  <button
                    onClick={() => setConceptWindows((p) => ({ ...p, [label]: win + WORD_WINDOW_STEP }))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: mono, fontSize: 11, fontWeight: 700, color: COLORS.heading, cursor: "pointer", marginBottom: 8 }}
                  >
                    Show more · 顯示更多 ({list.length - shown.length})
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}
        </>
      )}
    </div>
  );
}

// Synthesize section.content from a legacy analysedTechnique (skill saved
// before the `sections` field was added) so SectionCard can still render it.
function synthSectionFromTechnique(t) {
  const lines = [];
  // Encode the short title into the synthesized content so CollapsibleTechnique
  // and TrainingSession's section re-derive path both pick it up the same way.
  const titleSource = t.title || deriveShortTitle(t.technique || "");
  if (titleSource) lines.push(`SHORT TITLE: ${titleSource}`);
  if (t.technique) lines.push(`KEY IDEA: ${t.technique}`);
  if (t.description) lines.push(t.description);
  if (t.example) lines.push(`FROM THE TEXT: "${t.example}"`);
  if (t.structure) lines.push(`STRUCTURE: ${t.structure}`);
  return { title: t.technique || "TECHNIQUE", content: lines.join("\n\n") };
}

// Compact-by-default wrapper for a technique inside SavedSkillDetail. The
// collapsed row shows the short title (2-4 word skill name) as the big bold
// heading, with the long KEY IDEA sentence underneath as a smaller subtitle.
// Click → expand inline to render the full SectionCard. The ✎ button puts
// the title into inline-edit mode (Enter saves, Escape cancels); the × button
// removes the technique entirely from the saved skill.
function CollapsibleTechnique({ section, index, trackCall, selected, selectColor = COLORS.green, onToggleSelect, onRemove, onRename, onPractice, threadTurns = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const parts = parseSectionContent(section.content);
  const longSentence = parts.keyIdea || section.title || "";
  const title = parts.shortTitle || deriveShortTitle(longSentence) || longSentence || "Technique";

  const commitRename = (nextValue) => {
    const trimmed = (nextValue ?? "").trim();
    setEditing(false);
    if (!trimmed || trimmed === title) return;
    if (onRename) onRename(trimmed);
  };

  const removeBtn = onRemove ? (
    <button
      onClick={(e) => { e.stopPropagation(); onRemove(); }}
      title="Remove this technique"
      style={{ background: "none", border: "none", fontSize: 16, fontWeight: 700, color: COLORS.red || "#c44", cursor: "pointer", padding: "0 6px", lineHeight: 1, flexShrink: 0 }}
    >×</button>
  ) : null;

  if (expanded) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
          <button
            onClick={() => setExpanded(false)}
            style={{ background: "none", border: "none", fontSize: 11, color: COLORS.muted, cursor: "pointer", padding: "2px 6px", fontFamily: mono }}
          >
            ▾ Collapse
          </button>
          {removeBtn}
        </div>
        <SectionCard section={section} index={index} trackCall={trackCall} />
        {onPractice && (
          <button
            onClick={(e) => { e.stopPropagation(); onPractice(); }}
            style={{ marginTop: 8, width: "100%", fontSize: 12, fontFamily: mono, padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${COLORS.green}`, background: "transparent", color: COLORS.green, cursor: "pointer", fontWeight: 700, letterSpacing: 0.3 }}
          >
            {threadTurns > 0 ? `▶ Continue practising · ${threadTurns} turns` : "▶ Practise this technique"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => { if (!editing) setExpanded(true); }}
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${COLORS.accent1}`,
        borderRadius: 12,
        marginBottom: 8,
        padding: "12px 14px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 10,
        cursor: editing ? "default" : "pointer",
        transition: "border-color 0.15s",
      }}
    >
      {onToggleSelect && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          title={selected ? "Selected" : "Tap to select for practice"}
          style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${selected ? selectColor : COLORS.muted}`, background: selected ? selectColor : "transparent", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 1, padding: 0, lineHeight: 1 }}
        >
          {selected ? "✓" : ""}
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => commitRename(editValue)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); commitRename(editValue); }
              if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
            }}
            onClick={e => e.stopPropagation()}
            style={{ width: "100%", fontSize: 13, fontWeight: 700, color: COLORS.heading, fontFamily: mono, border: `1.5px solid ${COLORS.heading}`, background: COLORS.bg2, padding: "3px 8px", borderRadius: 8, outline: "none", boxSizing: "border-box" }}
          />
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, fontFamily: mono, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{index}. {title}</span>
              {onRename && (
                <button
                  onClick={e => { e.stopPropagation(); setEditValue(title); setEditing(true); }}
                  title="Rename this technique"
                  style={{ background: "none", border: "none", fontSize: 11, color: COLORS.muted, cursor: "pointer", padding: "1px 4px", opacity: 0.5, lineHeight: 1, flexShrink: 0 }}
                >✎</button>
              )}
            </div>
            {longSentence && longSentence !== title && (
              <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono, lineHeight: 1.5, marginTop: 4, fontWeight: 400 }}>
                {longSentence}
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {onPractice && !editing && (
          <button
            onClick={(e) => { e.stopPropagation(); onPractice(); }}
            title={threadTurns > 0 ? "Continue your practice chat" : "Practise this technique"}
            style={{ background: "none", border: `1px solid ${COLORS.green}`, color: COLORS.green, fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "3px 8px", borderRadius: 7, lineHeight: 1, fontFamily: mono, flexShrink: 0 }}
          >{threadTurns > 0 ? `▶ Continue · ${threadTurns}` : "▶ Practise"}</button>
        )}
        {removeBtn}
        <span style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono, lineHeight: 1.5 }}>›</span>
      </div>
    </div>
  );
}

function SavedSkillDetail({ skill, onBack, onApply, onPractice, onPracticeTechnique, onRemove, onRemoveTechnique, onRemoveTechniques, onRenameTechnique, onAnalyseMore, trackCall }) {
  // Prefer full saved sections (new format); fall back to synthesizing from
  // analysedTechniques (legacy skills saved before the sections field existed).
  const hasFullSections = skill.sections && skill.sections.length > 0;
  const sections = hasFullSections
    ? skill.sections
    : (skill.analysedTechniques || []).map(synthSectionFromTechnique);

  // The "PERFECT FOR" bullet parser greedily captured the trailing
  // "NOT SUITABLE FOR:" label into the last bullet; drop it here so older
  // saved skills display cleanly without re-analysing.
  const whenBullets = (skill.whenToUse?.bullets || [])
    .map(b => b.replace(/\s*NOT\s+SUITABLE\s+FOR[\s\S]*$/i, "").trim())
    .filter(Boolean);

  // "Practice" enters selection mode: a circle appears on each technique card
  // (descriptions stay visible) and the student ticks which to drill, then
  // "Practise (N)" launches only those. Circles are hidden until then.
  // selectMode is shared by Practice and Remove: a circle appears on each
  // technique card and the student ticks which ones to drill or delete.
  // null | "practice" | "remove". Circles are hidden until then.
  const [selectMode, setSelectMode] = useState(null);
  const selecting = selectMode !== null;
  const [selected, setSelected] = useState(() => new Set());
  const toggleSelect = (i) => setSelected(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const cancelSelect = () => { setSelectMode(null); setSelected(new Set()); };
  const beginPractice = () => { setSelected(new Set()); setSelectMode("practice"); };
  const beginRemove = () => { setSelected(new Set()); setSelectMode("remove"); };
  const practiseSelected = () => {
    const idxs = [...selected].sort((a, b) => a - b);
    if (!idxs.length || !onPractice) return;
    const pick = (arr) => Array.isArray(arr) ? idxs.map(i => arr[i]).filter(v => v !== undefined) : arr;
    onPractice({
      ...skill,
      // keep the real id when practising everything; use a subset id otherwise
      // so a partial selection's progress/chats stay separate from the full skill
      id: idxs.length === sections.length ? skill.id : `${skill.id}__sel_${idxs.join("-")}`,
      sections: hasFullSections ? idxs.map(i => skill.sections[i]).filter(Boolean) : skill.sections,
      analysedTechniques: pick(skill.analysedTechniques),
      researchedTechniques: pick(skill.researchedTechniques),
      techniques: pick(skill.techniques),
    });
  };
  const removeSelected = () => {
    const idxs = [...selected];
    if (!idxs.length) return;
    // Removing every technique = delete the whole skill.
    if (idxs.length === sections.length && onRemove) { onRemove(); return; }
    if (onRemoveTechniques) onRemoveTechniques(idxs, hasFullSections);
    cancelSelect();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", color: COLORS.heading, fontFamily: mono, fontSize: 13, cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
        >
          ← Back to writers
        </button>
      </div>
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.heading, fontFamily: mono }}>{skill.authorName}</div>
        {skill.signatureStyle && (
          <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: mono, marginTop: 4, lineHeight: 1.5 }}>
            {skill.signatureStyle}
          </div>
        )}
      </div>

      {!hasFullSections && (
        <div style={{ background: "#FBF6E6", border: `1px solid #E8D8B4`, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#6B4A20", fontFamily: mono, lineHeight: 1.5 }}>
          <strong>Legacy skill:</strong> only the key idea + brief description were saved.
          To see the full breakdown / why it works / watch out / writer's words sections,
          re-analyse the source passage and save again.
        </div>
      )}

      {skill.whenToUse?.keyIdea && (
        <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 12, background: "#E8E3DB", borderRadius: 10, padding: "10px 14px", fontFamily: mono }}>
          <span style={{ fontWeight: 700, color: COLORS.heading }}>When to use: </span>{skill.whenToUse.keyIdea}
          {whenBullets.length > 0 && (
            <div style={{ marginTop: 6, paddingLeft: 4, color: COLORS.muted, fontSize: 11 }}>
              {whenBullets.map((b, j) => <div key={j}>• {b}</div>)}
            </div>
          )}
        </div>
      )}

      {sections.length > 0 ? (
        (() => {
          // In-progress TrainingSession threads for this skill — the Practice
          // button on a technique with a live thread reads "Continue · N".
          const trainingChats = loadTrainingChats();
          return sections.map((s, i) => (
          <CollapsibleTechnique
            key={i}
            section={s}
            index={i + 1}
            trackCall={trackCall}
            selected={selected.has(i)}
            selectColor={selectMode === "remove" ? COLORS.red : COLORS.green}
            onToggleSelect={selecting ? () => toggleSelect(i) : null}
            onRemove={!selecting && onRemoveTechnique ? () => onRemoveTechnique(i, hasFullSections) : null}
            onRename={!selecting && onRenameTechnique ? (newTitle) => onRenameTechnique(i, newTitle, hasFullSections) : null}
            onPractice={!selecting && onPracticeTechnique ? () => onPracticeTechnique(i) : null}
            threadTurns={countThreadTurns(trainingChats, skill.id, i)}
          />
          ));
        })()
      ) : (
        <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic", padding: "20px 0", fontFamily: mono }}>
          No detail content saved for this skill.
        </div>
      )}

      {selecting && sections.length > 0 && (
        <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono, marginTop: 8 }}>
          {selected.size === 0
            ? `Tap the circles to choose which techniques to ${selectMode === "remove" ? "remove" : "practise"}.`
            : `${selected.size} of ${sections.length} selected ${selectMode === "remove" ? "to remove" : "for practice"}.`}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
        {selecting ? (
          <>
            <button
              onClick={cancelSelect}
              style={{ fontSize: 12, fontFamily: mono, padding: "8px 14px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, cursor: "pointer" }}
            >
              Cancel
            </button>
            {selectMode === "remove" ? (
              <button
                onClick={removeSelected}
                disabled={selected.size === 0}
                style={{ flex: 1, fontSize: 13, fontFamily: mono, padding: "8px 16px", borderRadius: 10, border: "none", background: selected.size ? COLORS.red : COLORS.bg3, color: "#fff", cursor: selected.size ? "pointer" : "not-allowed", fontWeight: 700, letterSpacing: 0.3 }}
              >
                Remove ({selected.size})
              </button>
            ) : (
              <button
                onClick={practiseSelected}
                disabled={selected.size === 0}
                style={{ flex: 1, fontSize: 13, fontFamily: mono, padding: "8px 16px", borderRadius: 10, border: "none", background: selected.size ? COLORS.green : COLORS.bg3, color: "#fff", cursor: selected.size ? "pointer" : "not-allowed", fontWeight: 700, letterSpacing: 0.3 }}
              >
                ▶ Practise ({selected.size})
              </button>
            )}
          </>
        ) : (
          <>
            {(onRemoveTechniques && sections.length > 0) ? (
              <button
                onClick={beginRemove}
                style={{ fontSize: 11, fontFamily: mono, padding: "6px 12px", borderRadius: 8, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, cursor: "pointer" }}
              >
                Remove
              </button>
            ) : onRemove ? (
              <button
                onClick={onRemove}
                style={{ fontSize: 11, fontFamily: mono, padding: "6px 12px", borderRadius: 8, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, cursor: "pointer" }}
              >
                Remove
              </button>
            ) : null}
            {onPractice && sections.length > 0 && (
              <button
                onClick={beginPractice}
                style={{ fontSize: 12, fontFamily: mono, padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${COLORS.green}`, background: "transparent", color: COLORS.green, cursor: "pointer", fontWeight: 700, letterSpacing: 0.3 }}
              >
                Practice
              </button>
            )}
            {onApply && (
              <button
                onClick={() => onApply(skill)}
                style={{ flex: 1, fontSize: 12, fontFamily: mono, padding: "8px 16px", borderRadius: 10, border: "none", background: COLORS.heading, color: "#fff", cursor: "pointer", fontWeight: 700, letterSpacing: 0.3 }}
              >
                ✦ Write with this skill
              </button>
            )}
          </>
        )}
      </div>

      {!selecting && onAnalyseMore && skill.sourceText && remainingSections(skill).length > 0 && (
        <div style={{ marginTop: 10 }}>
          <AnalyseMoreButton skill={skill} trackCall={trackCall} onMerged={(merged) => onAnalyseMore(merged)} style={{ width: "100%" }} />
        </div>
      )}
    </div>
  );
}

// Minimal markdown for freeform Masterclass reports — bold + bullets.
function renderReportMd(text) {
  if (!text) return null;
  // Heal any spoken Cantonese in saved reports to written 書面語 at render time
  // (old cards are never regenerated, so this is the only way to fix them).
  const bulletFixed = toWrittenChinese(text).replace(/^[ \t]*[*•]\s+/gm, "  • ");
  const parts = bulletFixed.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    return bold ? <strong key={i}>{bold[1]}</strong> : <span key={i}>{part}</span>;
  });
}

// One Masterclass Report card. Collapsed: technique + the student's polished
// sentence. Expanded: the 4-section structured view (auto reports) OR the
// verbatim Lyra report text (manual "Save this turn" reports). Delete uses
// the same two-step inline confirmation as the training-chat delete.
function AchievementCard({ report, index, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isStructured = !report.reportText;
  const dateLabel = (() => {
    try { return new Date(report.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
    catch (e) { return ""; }
  })();
  const headline = report.technique || (report.skills && report.skills[0] && report.skills[0].skillName) || "Writing win";
  const sentence = report.after || "";

  const sectionTitle = { fontSize: 10, fontWeight: 700, color: COLORS.accent1, textTransform: "uppercase", letterSpacing: 1, marginTop: 12, marginBottom: 4, fontFamily: mono };
  const bodyText = { fontSize: 12, color: COLORS.text, lineHeight: 1.6, fontFamily: mono };

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.green || COLORS.accent1}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, cursor: "pointer" }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, fontFamily: mono, lineHeight: 1.4 }}>
            {index}. {headline}
          </div>
          {sentence && (
            <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono, lineHeight: 1.5, marginTop: 4, fontStyle: "italic", overflow: expanded ? "visible" : "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" }}>
              "{sentence}"
            </div>
          )}
          {dateLabel && <div style={{ fontSize: 10, color: COLORS.muted, fontFamily: mono, marginTop: 4 }}>{dateLabel}{report.source === "manual" ? " · saved by you" : ""}</div>}
        </div>
        <span style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono, flexShrink: 0 }}>{expanded ? "▾" : "›"}</span>
      </div>

      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${COLORS.border}` }}>
          {isStructured ? (
            <>
              {report.skills?.length > 0 && (
                <>
                  <div style={sectionTitle}>1 · Skills Deployed</div>
                  {report.skills.map((sk, i) => (
                    <div key={i} style={bodyText}>
                      <strong>{sk.skillName}</strong>{sk.sourceAuthor ? ` — learned from ${sk.sourceAuthor}` : ""}{sk.studentApplication ? `. ${sk.studentApplication}` : ""}
                    </div>
                  ))}
                </>
              )}
              {report.structures?.length > 0 && (
                <>
                  <div style={sectionTitle}>2 · Sentence Structures & Rhythm Maps</div>
                  {report.structures.map((st, i) => (
                    <div key={i} style={{ ...bodyText, marginBottom: 4 }}>
                      <strong>{st.name}</strong>{st.description ? ` — ${st.description}` : ""}{st.effect ? ` (${st.effect})` : ""}
                      {st.chinese ? <div style={{ fontSize: 11, color: COLORS.muted }}>{st.chinese}</div> : null}
                    </div>
                  ))}
                </>
              )}
              {(report.before || report.after) && (
                <>
                  <div style={sectionTitle}>3 · Before & After Evolution</div>
                  {report.before && <div style={{ ...bodyText, marginBottom: 4 }}><strong>Before:</strong> {report.before}</div>}
                  {report.after && <div style={{ ...bodyText, marginBottom: 4 }}><strong>After:</strong> {report.after}</div>}
                  {report.why_better && <div style={{ ...bodyText, color: COLORS.muted }}><strong>Why it's better:</strong> {toWrittenChinese(report.why_better)}</div>}
                </>
              )}
              {report.vocabulary?.length > 0 && (
                <>
                  <div style={sectionTitle}>Vocabulary Gained</div>
                  {report.vocabulary.map((v, i) => (
                    <div key={i} style={bodyText}>{v.weak} → <strong>{v.strong}</strong>{v.chinese ? ` (${toWrittenChinese(v.chinese)})` : ""}</div>
                  ))}
                </>
              )}
              {report.grammar?.length > 0 && (
                <>
                  <div style={sectionTitle}>4 · Grammar & Proofreading</div>
                  {report.grammar.map((gr, i) => (
                    <div key={i} style={{ ...bodyText, marginBottom: 4 }}>
                      <strong>{gr.phrase} → {gr.correction}</strong>{gr.explanation ? ` — ${toWrittenChinese(gr.explanation)}` : ""}
                      {gr.chinese ? <div style={{ fontSize: 11, color: COLORS.muted }}>{toWrittenChinese(gr.chinese)}</div> : null}
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            <div style={{ ...bodyText, whiteSpace: "pre-wrap", marginTop: 12 }}>{renderReportMd(report.reportText)}</div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 14 }}>
            {confirming ? (
              <>
                <button onClick={() => setConfirming(false)} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 10, fontWeight: 600, cursor: "pointer", padding: "4px 10px", fontFamily: mono, borderRadius: 6 }}>Cancel</button>
                <button onClick={onRemove} style={{ background: COLORS.red || "#c44", border: `1px solid ${COLORS.red || "#c44"}`, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "4px 10px", fontFamily: mono, borderRadius: 6 }}>Tap again to delete</button>
              </>
            ) : (
              <button onClick={() => setConfirming(true)} style={{ background: "transparent", border: "none", color: COLORS.red || "#c44", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "2px 6px", fontFamily: mono, textTransform: "uppercase", letterSpacing: 0.5 }}>Delete</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// groupReports + the report-clustering dedup now live in src/report-utils.js
// (shared with the Continuous Growth Report and unit-tested there).

export function MasterclassReports({ onCountChange }) {
  const [reports, setReports] = useState(() => JSON.parse(localStorage.getItem("lyra-masterclass-reports") || "[]"));
  // ONE card per technique: continued practice on the same skill folds into the
  // same card instead of stacking a new wall-of-words card every turn.
  const groups = groupAchievements(reports);

  useEffect(() => { if (onCountChange) onCountChange(groups.length); }, [groups.length]);

  // A card stands for a whole technique; deleting it removes every report that
  // accumulated under that technique.
  const removeGroup = (members) => {
    const set = new Set(members);
    const next = reports.filter(r => !set.has(r));
    setReports(next);
    localStorage.setItem("lyra-masterclass-reports", JSON.stringify(next));
    if (onCountChange) onCountChange(groupAchievements(next).length);
  };

  if (groups.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <FeatherIcon size={24} color={COLORS.accent2} />
        <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 12, lineHeight: 1.5, fontFamily: mono }}>
          No reports yet. When you practise a technique with Lyra, a Masterclass Report (your gains + the mistakes you fixed) shows up here.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 12, fontFamily: mono }}>
        {groups.length} achievement{groups.length !== 1 ? "s" : ""}
      </div>
      {groups.map((g, i) => (
        <AchievementCard key={i} report={g.display} index={i + 1} onRemove={() => removeGroup(g.members)} />
      ))}
    </div>
  );
}

export function SavedSkills({ onCountChange, onApply, onPractice, trackCall }) {
  const [skills, setSkills] = useState(() => {
    const s = JSON.parse(localStorage.getItem("lyra-style-skills") || "[]");
    if (onCountChange) setTimeout(() => onCountChange(s.length), 0);
    return s;
  });
  const [viewingIdx, setViewingIdx] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editName, setEditName] = useState("");
  const [confirmIdx, setConfirmIdx] = useState(null);

  const rename = (idx, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) { setEditingIdx(null); return; }
    const next = skills.map((sk, i) => i === idx ? { ...sk, authorName: trimmed } : sk);
    setSkills(next);
    localStorage.setItem("lyra-style-skills", JSON.stringify(next));
    setEditingIdx(null);
  };

  const remove = (idx) => {
    const next = skills.filter((_, i) => i !== idx);
    setSkills(next);
    localStorage.setItem("lyra-style-skills", JSON.stringify(next));
    if (viewingIdx === idx) setViewingIdx(null);
    else if (viewingIdx !== null && viewingIdx > idx) setViewingIdx(viewingIdx - 1);
    if (onCountChange) onCountChange(next.length);
  };

  // Remove a single technique from a saved skill. Mutates both `sections`
  // (new format) and `analysedTechniques` (legacy / parallel array) if the
  // technique exists in both, so the list stays in sync regardless of which
  // source the detail view was rendering from.
  const removeTechnique = (skillIdx, techIdx, hasFullSections) => {
    const target = skills[skillIdx];
    if (!target) return;
    const updated = { ...target };
    if (hasFullSections && updated.sections) {
      updated.sections = updated.sections.filter((_, i) => i !== techIdx);
      // Keep the parallel arrays in lockstep with `sections` — downstream code
      // (the display title override, and TrainingSession's anonTechs[techIdx]
      // for coaching + new-sentence generation) indexes analysedTechniques by
      // the SAME position as sections; filtering only sections desyncs them and
      // sends the wrong technique after a removal.
      if (Array.isArray(updated.analysedTechniques)) updated.analysedTechniques = updated.analysedTechniques.filter((_, i) => i !== techIdx);
      if (Array.isArray(updated.techniques)) updated.techniques = updated.techniques.filter((_, i) => i !== techIdx);
    } else if (updated.analysedTechniques) {
      updated.analysedTechniques = updated.analysedTechniques.filter((_, i) => i !== techIdx);
      if (updated.techniques) {
        updated.techniques = updated.techniques.filter((_, i) => i !== techIdx);
      }
    }
    const next = skills.map((s, i) => i === skillIdx ? updated : s);
    setSkills(next);
    localStorage.setItem("lyra-style-skills", JSON.stringify(next));
  };

  // Batch-remove several techniques at once (the Remove selection mode).
  // Filtering all indices in one pass avoids the index-shift bug you'd hit by
  // calling the single-remove repeatedly. Mirrors removeTechnique's
  // sections-vs-analysedTechniques branch.
  const removeTechniques = (skillIdx, techIdxs, hasFullSections) => {
    const target = skills[skillIdx];
    if (!target || !techIdxs || !techIdxs.length) return;
    const drop = new Set(techIdxs);
    const updated = { ...target };
    if (hasFullSections && updated.sections) {
      updated.sections = updated.sections.filter((_, i) => !drop.has(i));
      // Filter the parallel arrays by the SAME indices (see removeTechnique).
      if (Array.isArray(updated.analysedTechniques)) updated.analysedTechniques = updated.analysedTechniques.filter((_, i) => !drop.has(i));
      if (Array.isArray(updated.techniques)) updated.techniques = updated.techniques.filter((_, i) => !drop.has(i));
    } else if (updated.analysedTechniques) {
      updated.analysedTechniques = updated.analysedTechniques.filter((_, i) => !drop.has(i));
      if (updated.techniques) {
        updated.techniques = updated.techniques.filter((_, i) => !drop.has(i));
      }
    }
    const next = skills.map((sk, i) => i === skillIdx ? updated : sk);
    setSkills(next);
    localStorage.setItem("lyra-style-skills", JSON.stringify(next));
  };

  // Rename a single technique's short title. Persists in BOTH places so the
  // TrainingSession's re-derive-from-sections path and any code path that
  // reads analysedTechniques[i].title see the same value:
  //   - skill.analysedTechniques[i].title  (parallel array)
  //   - skill.sections[i].content          (rewritten SHORT TITLE: line, or
  //                                         inserted if the section was saved
  //                                         before the SHORT TITLE field
  //                                         existed)
  const renameTechnique = (skillIdx, techIdx, newTitle, hasFullSections) => {
    const target = skills[skillIdx];
    if (!target || !newTitle) return;
    const updated = { ...target };

    if (updated.analysedTechniques && updated.analysedTechniques[techIdx]) {
      updated.analysedTechniques = updated.analysedTechniques.map((t, i) =>
        i === techIdx ? { ...t, title: newTitle } : t
      );
    }

    if (hasFullSections && updated.sections && updated.sections[techIdx]) {
      updated.sections = updated.sections.map((sec, i) => {
        if (i !== techIdx) return sec;
        const content = sec.content || "";
        const hasShortTitle = /^SHORT TITLE:\s*.+$/m.test(content);
        const newContent = hasShortTitle
          ? content.replace(/^SHORT TITLE:\s*.+$/m, `SHORT TITLE: ${newTitle}`)
          : `SHORT TITLE: ${newTitle}\n${content}`;
        return { ...sec, content: newContent };
      });
    }

    const next = skills.map((s, i) => i === skillIdx ? updated : s);
    setSkills(next);
    localStorage.setItem("lyra-style-skills", JSON.stringify(next));
  };

  if (skills.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <FeatherIcon size={24} color={COLORS.accent2} />
        <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 12, lineHeight: 1.5, fontFamily: mono }}>
          No writers yet. Analyse a passage to learn your first writer's skills.
        </div>
      </div>
    );
  }

  // Detail view — opened by clicking a skill title in the list
  if (viewingIdx !== null && skills[viewingIdx]) {
    return (
      <SavedSkillDetail
        skill={skills[viewingIdx]}
        onBack={() => setViewingIdx(null)}
        onApply={onApply}
        onPractice={onPractice}
        onPracticeTechnique={onPractice ? (techIdx) => onPractice(skills[viewingIdx], techIdx) : null}
        onRemove={() => remove(viewingIdx)}
        onRemoveTechnique={(techIdx, hasFullSections) => removeTechnique(viewingIdx, techIdx, hasFullSections)}
        onRemoveTechniques={(techIdxs, hasFullSections) => removeTechniques(viewingIdx, techIdxs, hasFullSections)}
        onRenameTechnique={(techIdx, newTitle, hasFullSections) => renameTechnique(viewingIdx, techIdx, newTitle, hasFullSections)}
        onAnalyseMore={(merged) => setSkills(prev => prev.map((sk, i) => i === viewingIdx ? merged : sk))}
        trackCall={trackCall}
      />
    );
  }

  // Compact list view — title only, click to open full detail
  return (
    <div>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 12, fontFamily: mono }}>
        {skills.length} writer{skills.length !== 1 ? "s" : ""} saved — tap one to see their skills
      </div>
      {skills.map((sk, i) => (
        <div
          key={sk.id}
          onClick={() => editingIdx !== i && confirmIdx !== i && setViewingIdx(i)}
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderLeft: `3px solid ${sk.type === "researched" ? COLORS.blue : COLORS.accent1}`,
            borderRadius: 12,
            marginBottom: 8,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            cursor: editingIdx === i ? "default" : "pointer",
            transition: "border-color 0.15s",
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
            {editingIdx === i ? (
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => rename(i, editName)}
                onKeyDown={e => { if (e.key === "Enter") rename(i, editName); if (e.key === "Escape") setEditingIdx(null); }}
                onClick={e => e.stopPropagation()}
                style={{ width: "100%", fontSize: 13, fontWeight: 700, color: COLORS.heading, fontFamily: mono, border: `1.5px solid ${COLORS.heading}`, background: COLORS.bg2, padding: "3px 8px", borderRadius: 8, outline: "none", boxSizing: "border-box" }}
              />
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, fontFamily: mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sk.authorName}</div>
                {(() => {
                  // Each row is a WRITER; show how many of their skills live inside.
                  const n = (sk.sections?.length) || (sk.analysedTechniques?.length) || (sk.techniques?.length) || 0;
                  return n > 0 ? (
                    <span style={{ fontSize: 10, color: COLORS.muted, fontFamily: mono, whiteSpace: "nowrap", flexShrink: 0, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "1px 7px" }}>
                      {n} skill{n !== 1 ? "s" : ""}
                    </span>
                  ) : null;
                })()}
                <button
                  onClick={e => { e.stopPropagation(); setEditingIdx(i); setEditName(sk.authorName); }}
                  title="Rename writer"
                  style={{ background: "none", border: "none", fontSize: 11, color: COLORS.muted, cursor: "pointer", padding: "1px 4px", opacity: 0.5, lineHeight: 1, flexShrink: 0 }}
                >✎</button>
              </>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {confirmIdx === i ? (
              <>
                <button
                  onClick={() => { remove(i); setConfirmIdx(null); }}
                  style={{ background: COLORS.red || "#c44", border: `1px solid ${COLORS.red || "#c44"}`, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "4px 10px", fontFamily: mono, borderRadius: 6, whiteSpace: "nowrap" }}
                >Tap to delete</button>
                <button
                  onClick={() => setConfirmIdx(null)}
                  style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 10, fontWeight: 600, cursor: "pointer", padding: "4px 8px", fontFamily: mono, borderRadius: 6 }}
                >Cancel</button>
              </>
            ) : (
              <>
                {editingIdx !== i && (
                  <button
                    onClick={() => setConfirmIdx(i)}
                    title="Remove skill"
                    style={{ background: "none", border: "none", fontSize: 16, color: COLORS.red || "#c44", cursor: "pointer", padding: "1px 5px", opacity: 0.5, lineHeight: 1, flexShrink: 0 }}
                  >×</button>
                )}
                <span style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono, flexShrink: 0 }}>›</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// §44 (model A): the header ← is the single "go back" control. It steps back
// through the tabs the student actually visited, then — once the history is empty
// (they're at their entry tab) — backs out of Style Lab entirely. One control,
// one "go back" meaning that degrades from "back a tab" to "back out". Pure
// helpers, exported for tests.
export const TAB_HISTORY_CAP = 10;
// Push the tab being LEFT onto the history when switching to a different tab. A
// same-tab switch is a no-op (collapse consecutive duplicates); the stack is
// capped so a long session can't grow it without bound.
export function pushTabHistory(history, leavingTab, nextTab) {
  if (nextTab === leavingTab) return history;
  return [...history, leavingTab].slice(-TAB_HISTORY_CAP);
}
// Pop the most-recent tab to return to. Returns { tab, history }, or null on an
// empty stack — the signal that the ← should exit Style Lab instead.
export function popTabHistory(history) {
  if (history.length === 0) return null;
  return { tab: history[history.length - 1], history: history.slice(0, -1) };
}
// Pure predicate — empty history ⇒ the ← backs out of Style Lab.
export function styleLabBackExits(history) {
  return history.length === 0;
}
export default function StyleLab({ showStyleLab, setShowStyleLab, setSidebarOpen, projects, trackCall, setAppliedSkill, setWritingTechniques, initialTab, onOpenTraining, writingType }) {
  const [activeTab, setActiveTab] = useState("analyze");
  // Tab-history stack so the header ← steps back through the tabs the student
  // visited, and only closes Style Lab once there's no earlier tab left. A direct
  // tab tap also pushes, so back retraces the real path taken.
  const [tabHistory, setTabHistory] = useState([]);
  const goToTab = (key) => {
    if (key === activeTab) return;
    setTabHistory(h => pushTabHistory(h, activeTab, key));
    setActiveTab(key);
  };
  const goBack = () => {
    if (styleLabBackExits(tabHistory)) { setShowStyleLab(false); return; }  // at entry tab → back out
    const { tab, history } = popTabHistory(tabHistory);
    setTabHistory(history);
    setActiveTab(tab);
  };

  // Jump to the requested tab when StyleLab opens; reset tab history on open AND
  // close (a fresh visit starts clean — no stale back targets). The initial tab is
  // the bottom of the stack, so the first back from it exits cleanly.
  useEffect(() => {
    if (!showStyleLab) { setActiveTab("analyze"); setTabHistory([]); return; }
    if (initialTab) setActiveTab(initialTab);
    setTabHistory([]);
  }, [showStyleLab, initialTab]);
  const [referenceText, setReferenceText] = useState("");
  const [styleProfile, setStyleProfile] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [profileSections, setProfileSections] = useState([]);
  const [error, setError] = useState("");

  // Original-text translation on the Analyse tab (mirrors XRayView's toggle)
  const [translation, setTranslation] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);

  const handleTranslateOriginal = async () => {
    if (!referenceText || translating) return;
    if (showTranslation) { setShowTranslation(false); return; }
    if (translation) { setShowTranslation(true); return; }
    setTranslating(true);
    try {
      const route = getRouteConfig("translate");
      const result = await translateWithGuard(referenceText, route, trackCall);
      setTranslation(result);
      setShowTranslation(true);
    } catch (e) {
      setTranslation("翻譯失敗，請再試一次。");
      setShowTranslation(true);
    }
    setTranslating(false);
  };


  const [savedCount, setSavedCount] = useState(() => JSON.parse(localStorage.getItem("lyra-saved-concepts") || "[]").length);

  // The app-level word dictionary saves vocab into lyra-saved-concepts from
  // outside StyleLab — listen for its change event so the "Saved (N)" badge
  // stays fresh without prop threading.
  useEffect(() => {
    const onConceptsChanged = () => {
      try { setSavedCount(JSON.parse(localStorage.getItem("lyra-saved-concepts") || "[]").length); } catch (e) { /* silent */ }
    };
    window.addEventListener("lyra-concepts-changed", onConceptsChanged);
    return () => window.removeEventListener("lyra-concepts-changed", onConceptsChanged);
  }, []);
  const [skillSaved, setSkillSaved] = useState(null); // null | "saved" | "too-short"
  const [skillInStore, setSkillInStore] = useState(false); // whether the analysed skill is currently in localStorage (false after a manual remove)
  const [skillCount, setSkillCount] = useState(() => JSON.parse(localStorage.getItem("lyra-style-skills") || "[]").length);
  // Grouped (one per technique) so the tab badge matches the card count before
  // the tab is even opened — MasterclassReports re-reports the same number via onCountChange.
  const [achievementCount, setAchievementCount] = useState(() => groupAchievements(JSON.parse(localStorage.getItem("lyra-masterclass-reports") || "[]")).length);

  const analyseEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll analyse tab as new sections stream in
  useEffect(() => {
    if (analyseEndRef.current && profileSections.length > 0) {
      analyseEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [profileSections]);

  // Re-check whether the analysed skill is still in localStorage whenever the
  // student returns to the Analyse tab — so removing it from the Skills tab
  // flips the "saved" banner to an "Add to Skills" recovery button.
  useEffect(() => {
    if (activeTab !== "analyze" || skillSaved !== "saved") return;
    try {
      const arr = JSON.parse(localStorage.getItem("lyra-style-skills") || "[]");
      setSkillInStore(arr.some(sk => sk.authorName === authorName));
    } catch (e) { /* ignore */ }
  }, [activeTab, skillSaved, authorName]);

  // Re-save the analysed skill (recovery path after a manual remove).
  // saveStyleSkill dedupes by authorName, so this never creates a duplicate.
  const handleAddToSkills = () => {
    const saved = saveStyleSkill(authorName, profileSections, referenceText);
    if (saved) {
      setSkillInStore(true);
      setSkillCount(JSON.parse(localStorage.getItem("lyra-style-skills") || "[]").length);
    }
  };

  const wordCount = referenceText.trim() ? referenceText.trim().split(/\s+/).length : 0;

  const resetAll = useCallback(() => {
    setReferenceText("");
    setStyleProfile("");
    setAnalyzing(false);
    setAuthorName("");
    setProfileSections([]);
    setError("");
    setActiveTab("analyze");
    setTabHistory([]);
    setSkillSaved(null);
    setSkillInStore(false);
    setTranslation("");
    setShowTranslation(false);
  }, []);

  const analyzeStyle = useCallback(async () => {
    if (!referenceText.trim() || referenceText.trim().split(/\s+/).length < 80) return;
    setAnalyzing(true);
    setError("");
    setTranslation("");
    setShowTranslation(false);
    try {
      // Cross-author technique referencing: pass existing skill names so the AI can surface connections
      let existingSkillsCtx = "";
      try {
        const saved = JSON.parse(localStorage.getItem("lyra-style-skills") || "[]");
        if (saved.length > 0) {
          const skillList = saved.flatMap(sk => {
            const techs = sk.analysedTechniques || sk.researchedTechniques || (sk.techniques || []).map(t => typeof t === 'string' ? { technique: t } : t);
            return techs.map(t => t.technique);
          }).filter(Boolean);
          if (skillList.length > 0) {
            existingSkillsCtx = `\n\nCROSS-REFERENCE: The student has previously studied these techniques from other authors: ${skillList.join(", ")}. If this new text uses any of the SAME techniques, mention the connection: "This writer also uses [technique] (like in your previous analysis), but [how they use it differently]." Only mention genuine overlaps — do not force connections. Refer to the connection by TECHNIQUE NAME ONLY — never "Writer A", "Writer B" or any Writer label (the student never sees those labels here).`;
          }
        }
      } catch (e) { /* silent */ }
      const userMsg = referenceText + existingSkillsCtx;

      const analysisRoute = getRouteConfig("style_analysis");
      trackCall();
      // One requested set for the prompt AND both parse sites — the clamp must
      // match what was asked for, or the curation contract drifts.
      const requestedSections = defaultXraySections(writingType);
      const result = await callAI(buildStyleProfilerPrompt(requestedSections), userMsg, false, 10000, analysisRoute.thinkingBudget, (partial) => {
        // Live-update as tokens stream in
        const clean = stripLearningData(partial);
        const author = extractAuthor(clean);
        if (author !== "Unknown Author") setAuthorName(author);
        const sections = filterSectionsToRequested(parseProfileSections(clean), requestedSections);
        if (sections.length > 0) {
          setProfileSections(sections);
          setAnalyzing(false);
        }
      }, undefined, analysisRoute.model);
      if (!result || !result.trim()) {
        setError("No response received. Please check your API connection and try again.");
      } else {
        const clean = stripLearningData(result);
        setStyleProfile(clean);
        const author = extractAuthor(clean);
        setAuthorName(author);
        const sections = filterSectionsToRequested(parseProfileSections(clean), requestedSections);
        if (sections.length === 0) {
          setProfileSections([{ title: "STYLE ANALYSIS", content: clean }]);
        } else {
          setProfileSections(sections);
          const savedSkill = saveStyleSkill(author, sections, referenceText);
          setSkillCount(JSON.parse(localStorage.getItem("lyra-style-skills") || "[]").length);
          setSkillSaved(savedSkill ? "saved" : "too-short");
          setSkillInStore(!!savedSkill);
        }
      }
    } catch (e) {
      console.error("Style Lab analysis error:", e);
      setError(e.message || "Analysis failed. Please try again.");
    }
    setAnalyzing(false);
  }, [referenceText, trackCall, writingType]);

  if (!showStyleLab) return null;

  const hasProfile = profileSections.length > 0;
  // Same count the app's ☰ badge shows (total writings across projects).
  const totalWritings = (projects || []).reduce((sum, p) => sum + (p.writings ? p.writings.length : 0), 0);

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, maxWidth: 430, margin: "0 auto", background: COLORS.bg1, zIndex: 100, display: "flex", flexDirection: "column", animation: "fadeIn 0.25s ease" }}>
      {/* Header */}
      <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${COLORS.border}`, background: COLORS.card, flexShrink: 0 }}>
        {/* §44: the app's ☰ menu, reused as-is — the SAME 36×36 control + count badge +
            open handler the main app / source-setup use — so Style Lab shares the app's
            top-left pattern (☰ then ←) instead of being a nav island. The sidebar (z 70)
            sits BELOW this overlay (z 100), so the ☰ closes Style Lab as it opens the
            sidebar (the app's home path; "New Writing" then lands on the front page). */}
        <button
          onClick={() => { setShowStyleLab(false); setSidebarOpen && setSidebarOpen(true); }}
          aria-label="Menu"
          style={{ width: 44, height: 44, padding: 0, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          {/* §47/Unit 4: the visible glyph is a 36×36 circle (matches the app's ☰
              everywhere) wrapped in a 44×44 tappable button so the hit target stays ≥44. */}
          <span style={{ position: "relative", width: 36, height: 36, borderRadius: 18, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: COLORS.muted }}>
            ☰
            {totalWritings > 0 && (
              <span style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: 8, background: COLORS.blue, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{totalWritings > 99 ? "99" : totalWritings}</span>
            )}
          </span>
        </button>
        {/* §44 (model A): ONE small "go back" control — a plain ← icon, not a wide
            labelled button. It steps back through the tab history, then backs out of
            Style Lab once the student is at their entry tab (goBack). Sits next to the ☰
            (back-then-exit, §44 — unchanged). §47/Unit 4: same 36×36 circle + 44×44
            tappable wrapper as the ☰ — matched pair, ≥44 hit. */}
        <button
          onClick={goBack}
          title="Back"
          aria-label="Back"
          style={{ width: 44, height: 44, padding: 0, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <span style={{ width: 36, height: 36, borderRadius: 18, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: COLORS.muted }}>&#8592;</span>
        </button>
        {/* §44: the wordmark is a SILENT home affordance (kept — option A) — tapping
            the title block jumps to Analyse (X-Ray) on every tab (a no-op on Analyse).
            No icon / button styling, so it never competes with the ☰/← controls — a
            harmless logo-tap shortcut to the X-Ray front page, distinct from ☰ (menu). */}
        <div
          onClick={() => goToTab("analyze")}
          title="Go to X-Ray"
          style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
        >
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 15, fontWeight: 700, color: COLORS.heading, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Style Lab</div>
          <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {hasProfile && authorName ? `Analysing: ${authorName}` : "Analyse & practise writing styles"}
          </div>
        </div>
        {hasProfile && (
          <button onClick={resetAll} style={{ padding: "6px 12px", borderRadius: 14, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, fontFamily: "'Courier Prime', monospace", fontSize: 11, cursor: "pointer", color: COLORS.muted }}>New analysis</button>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ padding: "12px 18px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", background: COLORS.bg3, borderRadius: 20, padding: 3 }}>
          {[
            { key: "analyze", label: "Analyse Style" },
            { key: "saved", label: savedCount > 0 ? `Saved (${savedCount})` : "Saved" },
            { key: "skills", label: skillCount > 0 ? `Writers (${skillCount})` : "Writers" },
            { key: "achievements", label: achievementCount > 0 ? `Achievements (${achievementCount})` : "Achievements" },
            { key: "report", label: "Report" },
          ].map(t => {
            return (
              <button
                key={t.key}
                onClick={() => goToTab(t.key)}
                style={{
                  flex: 1, padding: "8px 6px", borderRadius: 17, border: "none",
                  background: activeTab === t.key ? COLORS.card : "transparent",
                  fontFamily: "'Courier Prime', monospace", fontSize: 11,
                  color: activeTab === t.key ? COLORS.heading : COLORS.muted,
                  fontWeight: activeTab === t.key ? 700 : 400,
                  cursor: "pointer",
                  boxShadow: activeTab === t.key ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.2s",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* ANALYSE TAB */}
        {activeTab === "analyze" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
            {!hasProfile && !analyzing && (
              <>
                {error && (
                  <div style={{ ...s.card, marginBottom: 16, padding: 14, borderLeft: `3px solid ${COLORS.red}`, background: "#FFF5F5", maxHeight: 200, overflowY: "auto" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.red, marginBottom: 4, fontFamily: mono }}>Analysis failed</div>
                    <div style={{ fontSize: 10, color: COLORS.text, lineHeight: 1.5, wordBreak: "break-all", fontFamily: mono }}>{error}</div>
                  </div>
                )}
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <FeatherIcon size={28} color={COLORS.accent1} />
                  <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 10, lineHeight: 1.5, fontFamily: mono }}>
                    Paste a passage from any writer. Lyra will identify their style and build a deep linguistic profile you can practise with.
                  </p>
                </div>
                <textarea
                  value={referenceText}
                  onChange={e => setReferenceText(e.target.value)}
                  placeholder="Paste a passage here (at least 80 words)..."
                  style={{ width: "100%", minHeight: 180, padding: 16, borderRadius: 14, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: "'Courier Prime', monospace", fontSize: 13, color: COLORS.text, resize: "vertical", lineHeight: 1.7, boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: wordCount >= 80 ? COLORS.green : COLORS.muted, fontFamily: mono }}>
                    {wordCount} word{wordCount !== 1 ? "s" : ""}{wordCount < 80 ? ` (need ${80 - wordCount} more)` : " — ready"}
                  </div>
                </div>
                {/* Lyra curates the most useful lessons — task-matched when a
                    writing type is active, generic otherwise. No manual count. */}
                <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono, textAlign: "left", marginBottom: 12 }}>
                  Lyra will pick the {defaultXraySections(writingType).length} most useful lessons from this writing
                </div>

                <button
                  onClick={analyzeStyle}
                  disabled={wordCount < 80}
                  style={{ ...s.btn, width: "100%", ...(wordCount < 80 ? s.btnDisabled : {}) }}
                >
                  Analyse Style
                </button>
              </>
            )}

            {analyzing && (
              <div style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ animation: "featherWrite 1.8s ease-in-out infinite", display: "inline-block", marginBottom: 16 }}>
                  <FeatherIcon size={32} />
                </div>
                <div style={{ fontSize: 14, color: COLORS.heading, fontWeight: 700, marginBottom: 6, fontFamily: mono }}>Analysing style...</div>
                <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5, fontFamily: mono }}>
                  Searching for the author and building a deep linguistic profile. This may take a moment.
                </div>
              </div>
            )}

            {hasProfile && !analyzing && (
              <>
                {/* Author card */}
                <div style={{ ...s.card, marginBottom: 16, textAlign: "center", padding: 20, background: COLORS.bg2 }}>
                  <FeatherIcon size={24} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.heading, marginTop: 8, fontFamily: "'Courier Prime', monospace" }}>
                    {authorName}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4, fontFamily: mono }}>Style Profile — {profileSections.length} sections analysed</div>
                </div>

                {skillSaved === "too-short" && (
                  <div style={{ ...s.card, marginBottom: 12, padding: "10px 14px", borderLeft: `3px solid ${COLORS.amber}`, background: "#FFF8EE" }}>
                    <div style={{ fontSize: 11, color: COLORS.heading, fontFamily: mono, lineHeight: 1.5 }}>
                      This passage wasn't detailed enough to generate a reusable writing skill. Try a longer passage (100+ words) with varied sentence structures.
                    </div>
                  </div>
                )}
                {skillSaved === "saved" && skillInStore && (
                  <div style={{ ...s.card, marginBottom: 12, padding: "10px 14px", borderLeft: `3px solid ${COLORS.green}`, background: "#F0F6F1", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>&#10003;</span>
                    <div style={{ fontSize: 11, color: COLORS.heading, fontFamily: mono, lineHeight: 1.5 }}>
                      <strong>Writer saved</strong> — their skills are in the Writers tab to review and reuse
                    </div>
                  </div>
                )}
                {skillSaved === "saved" && !skillInStore && (
                  <div style={{ ...s.card, marginBottom: 12, padding: "10px 14px", borderLeft: `3px solid ${COLORS.accent1}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono, lineHeight: 1.5 }}>
                      This writer isn't in your Writers tab right now.
                    </div>
                    <button
                      onClick={handleAddToSkills}
                      style={{ ...s.chip, flexShrink: 0, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
                    >
                      &#10022; Add to Writers
                    </button>
                  </div>
                )}

                {/* Original text reference */}
                <details style={{ ...s.card, marginBottom: 12, padding: 0, cursor: "pointer" }}>
                  <summary style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono, listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 8, transition: "transform 0.2s" }}>&#9654;</span> Original text
                    </span>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTranslateOriginal(); }}
                      disabled={translating}
                      style={{ fontSize: 10, fontFamily: mono, padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${COLORS.border}`, background: translating ? COLORS.bg2 : COLORS.card, color: COLORS.heading, cursor: translating ? "default" : "pointer", textTransform: "none", letterSpacing: 0, fontWeight: 600 }}
                    >
                      {translating ? "翻譯中..." : showTranslation ? "隱藏翻譯" : "翻譯成中文"}
                    </button>
                  </summary>
                  <div style={{ padding: "0 14px 12px", fontSize: 12, color: COLORS.text, lineHeight: 1.8, fontFamily: mono, fontStyle: "italic", borderTop: `1px solid ${COLORS.border}`, marginTop: 0, paddingTop: 10 }}>
                    {referenceText}
                  </div>
                  {showTranslation && translation && (
                    <div style={{ padding: "10px 14px 12px", borderTop: `1px solid ${COLORS.border}`, fontFamily: mono }}>
                      {translation
                        .split(/\n\s*\n/)
                        .map(pair => pair.trim())
                        .filter(Boolean)
                        .map((pair, i) => {
                          const enMatch = pair.match(/^EN:\s*(.+?)(?:\n|$)/s);
                          const zhMatch = pair.match(/ZH:\s*(.+)$/s);
                          const en = enMatch ? enMatch[1].trim() : "";
                          const zh = zhMatch ? zhMatch[1].trim() : "";
                          if (!en && !zh) return null;
                          return (
                            <div key={i} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `1px dashed ${COLORS.border}` }}>
                              {en && <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.6, fontStyle: "italic" }}>{en}</div>}
                              {zh && <div style={{ fontSize: 13, color: COLORS.heading, lineHeight: 1.7, marginTop: 4 }}>{zh}</div>}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </details>

                {/* Section cards (WHEN TO USE renders as its own card below) */}
                {profileSections.filter(s => s.title !== "WHEN TO USE THIS STYLE").map((section, i) => (
                  <SectionCard key={i} section={section} trackCall={trackCall} onSave={() => setSavedCount(JSON.parse(localStorage.getItem("lyra-saved-concepts") || "[]").length)} />
                ))}

                {/* When-to-use card — rehomed from the removed "Use It" tab
                    (same parsing/markup; renders only when the analysis
                    included the section). */}
                {(() => {
                  const useItSection = profileSections.find(s => s.title === "WHEN TO USE THIS STYLE");
                  if (!useItSection) return null;
                  const parts = parseSectionContent(useItSection.content);
                  // Cut at NOT SUITABLE FOR so its label doesn't bleed into
                  // the last PERFECT FOR bullet.
                  const bodyText = ((parts.body || "") + "\n" + (useItSection.content || "")).split(/NOT\s+SUITABLE\s+FOR/i)[0];
                  const bullets = bodyText.match(/•[^•]+/g) || [];
                  return (
                    <>
                      <div style={{ ...s.card, marginBottom: 16, textAlign: "center", padding: 20, background: COLORS.bg2 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.heading, fontFamily: "'Courier Prime', monospace", marginBottom: 6 }}>When to Use This Style</div>
                        {parts.keyIdea && <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, fontFamily: mono }}>{parts.keyIdea}</div>}
                      </div>
                      {bullets.map((bullet, i) => {
                        const cleaned = bullet.replace(/^•\s*/, "").trim();
                        const dashIdx = cleaned.indexOf("—");
                        const situation = dashIdx > 0 ? cleaned.substring(0, dashIdx).trim() : cleaned;
                        const description = dashIdx > 0 ? cleaned.substring(dashIdx + 1).trim() : "";
                        return (
                          <div key={i} style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, borderRight: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.accent1}`, borderRadius: 14, marginBottom: 12, padding: 16, fontFamily: mono }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, marginBottom: 6 }}>{situation}</div>
                            {description && <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7 }}>{description}</div>}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
                <div ref={analyseEndRef} />

                <div style={{ display: "flex", gap: 10, marginTop: 16, marginBottom: 8 }}>
                  <button
                    onClick={resetAll}
                    style={{ ...s.chip, flex: 1, textAlign: "center", fontSize: 13 }}
                  >
                    Analyse new text
                  </button>
                  {(() => {
                    // The Practice tab is gone — practising now opens the real
                    // TrainingSession on the just-auto-saved writer. Hidden when
                    // the analysis was too short to save or the writer removed.
                    const sk = skillSaved === "saved" && skillInStore ? loadSavedSkill(authorName) : null;
                    return sk && onOpenTraining ? (
                      <button
                        onClick={() => { setShowStyleLab(false); onOpenTraining(sk); }}
                        style={{ ...s.btn, flex: 1, fontSize: 14 }}
                      >
                        Start Practising
                      </button>
                    ) : null;
                  })()}
                </div>
              </>
            )}
          </div>
        )}

        {/* SAVED TAB */}
        {activeTab === "saved" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
            <SavedConcepts />
          </div>
        )}

        {/* SKILLS TAB */}
        {activeTab === "skills" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
            {/* §48: no onApply here — the editor auto-surfaces saved skills (onboarding
                skill_match → apply; the coach reads saved skills directly), so the
                Writers-tab "✦ Write with this skill" deploy is redundant. The detail's
                bottom row is Remove · Practice. (The editor's ✦ Skills picker still
                passes onApply, so deliberate mid-writing deploy keeps working there.) */}
            <SavedSkills onCountChange={setSkillCount} trackCall={trackCall} onPractice={onOpenTraining ? (skill, techIdx) => {
              // Per-technique practice (techIdx is a number) opens the exercise
              // as an overlay ON TOP of this skill detail and keeps StyleLab
              // mounted underneath, so closing the exercise returns to the same
              // skill-detail card list. Whole-skill practice (no techIdx) opens
              // the full Practice Session overview, so we close StyleLab.
              if (!Number.isInteger(techIdx)) setShowStyleLab(false);
              onOpenTraining(skill, techIdx);
            } : null} />
          </div>
        )}

        {/* ACHIEVEMENTS TAB — the per-practice detailed cards (gains + mistakes) */}
        {activeTab === "achievements" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
            <MasterclassReports onCountChange={setAchievementCount} />
          </div>
        )}

        {/* REPORT TAB — Lyra's Continuous Growth Report */}
        {activeTab === "report" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
            <GrowthReport trackCall={trackCall} />
          </div>
        )}

      </div>
    </div>
  );
}
