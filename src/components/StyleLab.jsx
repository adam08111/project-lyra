import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS } from "../constants.js";
import { sharedStyles as s } from "../styles.js";
import { callAI } from "../api.js";
import { getRouteConfig } from "../ai-router.js";
import { styleProfilerPrompt, styleCoachPrompt, translatePrompt, TRANSLATE_SCHEMA } from "../prompts.js";
import { FeatherIcon } from "./Icons.jsx";
import { useTypewriter } from "../hooks.js";
import XRayView, {
  parseProfileSections, parseSectionContent, parseAnnotations,
  labelColorIndex, ANNOTATION_COLORS, AnnotatedQuote, SectionCard,
  extractAuthor, saveStyleSkill, mono, parseTranslationPairs,
  stripRedundantPrefix,
} from "./XRayView.jsx";

function CoachMessage({ text, profileSections }) {
  const [expandedRef, setExpandedRef] = useState(null);

  // Parse the response into ORIGINAL, REWRITE, CONCEPTS APPLIED
  const lines = text.split("\n");
  const parts = { original: "", rewrite: "", concepts: [] };
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("ORIGINAL:")) {
      parts.original = trimmed.replace("ORIGINAL:", "").trim();
      currentSection = "original";
    } else if (trimmed.startsWith("REWRITE:")) {
      parts.rewrite = trimmed.replace("REWRITE:", "").trim();
      currentSection = "rewrite";
    } else if (trimmed.startsWith("CONCEPTS APPLIED")) {
      currentSection = "concepts";
      // Handle bullets on same line as header: "CONCEPTS APPLIED: • bullet..."
      const afterHeader = trimmed.replace(/^CONCEPTS APPLIED[:\s]*/i, "");
      if (afterHeader && /^[•\-*]/.test(afterHeader)) {
        const bullet = afterHeader.replace(/^[•\-*]\s*/, "");
        const refMatch = bullet.match(/\(from\s+([^)]+)\)/i);
        const sectionName = refMatch ? refMatch[1].trim().toUpperCase() : null;
        parts.concepts.push({ text: bullet, sectionName });
      }
    } else if (currentSection === "concepts" && (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*"))) {
      const bullet = trimmed.replace(/^[•\-*]\s*/, "");
      const refMatch = bullet.match(/\(from\s+([^)]+)\)/i);
      const sectionName = refMatch ? refMatch[1].trim().toUpperCase() : null;
      parts.concepts.push({ text: bullet, sectionName });
    } else if (currentSection === "rewrite" && trimmed && !trimmed.startsWith("CONCEPTS")) {
      parts.rewrite += " " + trimmed;
    }
  }

  // Find matching profile section (exact match first, then partial/fuzzy)
  const findSection = (name) => {
    if (!name || !profileSections) return null;
    const n = name.toUpperCase();
    return profileSections.find(s => s.title.toUpperCase() === n)
      || profileSections.find(s => s.title.toUpperCase().includes(n) || n.includes(s.title.toUpperCase()));
  };

  // If parsing failed, just show raw text
  if (!parts.original && !parts.rewrite && parts.concepts.length === 0) {
    return <span>{text}</span>;
  }

  return (
    <div style={{ fontSize: 13, lineHeight: 1.7, fontFamily: mono }}>
      {parts.original && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Original</div>
          <div style={{ color: COLORS.muted, fontStyle: "italic" }}>{parts.original}</div>
        </div>
      )}
      {parts.rewrite && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Rewrite</div>
          <div style={{ color: COLORS.heading, fontWeight: 600 }}>{parts.rewrite}</div>
        </div>
      )}
      {parts.concepts.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Concepts Applied</div>
          {parts.concepts.map((c, i) => {
            const matchedSection = findSection(c.sectionName);
            const isExpanded = expandedRef === i;
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.6 }}>• {(() => {
                  // Highlight "Grammar pattern: ..." in the bullet
                  const gpMatch = c.text.match(/^(.*?)(Grammar pattern:\s*"[^"]*")(\.?\s*)(.*)/i);
                  if (gpMatch) {
                    return <>
                      {gpMatch[1]}
                      <span style={{ background: "#EDE9E5", padding: "1px 4px", borderRadius: 4, fontWeight: 600, fontSize: 11 }}>{gpMatch[2]}</span>
                      {gpMatch[3]}{gpMatch[4]}
                    </>;
                  }
                  return c.text;
                })()}</div>
                {matchedSection && (
                  <div
                    onClick={() => setExpandedRef(isExpanded ? null : i)}
                    style={{ fontSize: 10, color: COLORS.accent1, cursor: "pointer", marginTop: 3, marginLeft: 14, display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <span style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>&#9654;</span>
                    View from analysis: {matchedSection.title}
                  </div>
                )}
                {isExpanded && matchedSection && (() => {
                  const p = parseSectionContent(matchedSection.content);
                  return (
                    <div style={{
                      marginTop: 6, marginLeft: 14, padding: "10px 12px",
                      background: "#F5F0EB", borderLeft: `3px solid ${COLORS.accent1}`,
                      borderRadius: "0 8px 8px 0", fontSize: 11, color: COLORS.text,
                      lineHeight: 1.6, maxHeight: 220, overflowY: "auto"
                    }}>
                      {p.keyIdea && (
                        <div style={{ fontWeight: 700, color: COLORS.heading, marginBottom: 6 }}>{p.keyIdea}</div>
                      )}
                      {p.example && (
                        <div style={{ fontStyle: "italic", color: COLORS.muted, marginBottom: 6 }}>{p.example}</div>
                      )}
                      {(() => {
                        const raw = p.breakdown;
                        if (!raw) return null;
                        const gramMatch = raw.match(/GRAMMAR:\s*(.*?)(?=\s*\|\s*FUNCTION:|$)/i);
                        const funcMatch = raw.match(/FUNCTION:\s*(.*?)(?=\s*\|\s*USE IT:|$)/i);
                        return (
                          <>
                            {gramMatch?.[1]?.trim() && (
                              <div style={{ marginBottom: 4 }}><span style={{ fontWeight: 700, color: COLORS.heading }}>Grammar: </span>{gramMatch[1].trim()}</div>
                            )}
                            {funcMatch?.[1]?.trim() && (
                              <div><span style={{ fontWeight: 700, color: COLORS.heading }}>Why use it: </span>{funcMatch[1].trim()}</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PracticeTypingBubble({ msg, onDone }) {
  const { displayed, done } = useTypewriter(msg.text, 14);
  const calledDone = useRef(false);
  useEffect(() => {
    if (done && !calledDone.current) {
      calledDone.current = true;
      onDone(msg);
    }
  }, [done, msg, onDone]);
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, animation: "fadeUp 0.25s ease" }}>
      <div style={{ marginTop: 4 }}><FeatherIcon size={16} /></div>
      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", fontSize: 13, lineHeight: 1.7, maxWidth: "85%", whiteSpace: "pre-wrap", fontFamily: mono }}>
        {displayed}{!done && <span style={{ animation: "blink 0.8s infinite", color: COLORS.accent1 }}>|</span>}
      </div>
    </div>
  );
}

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

// Chinese-side label patterns used to (a) route an unlabeled pair and
// (b) strip a redundant Chinese label prefix from the translation text.
const ZH_CONCEPT_LABELS = {
  grammar:  /^(文法|語法|文法模式|語法模式|文法結構|語法結構|句法|句子結構)[:：]/,
  function: /^(功能|作用|目的|用途|效用|效果)[:：]/,
  useIt:    /^(試著使用|試試看|試試|嘗試一下|請試試|練習|自己試試|動手試試|試著套用|嘗試套用|套用練習|套用模板|套用方法|來試試|你也試試|你來試試)[:：]/,
  example:  /^(文中引述|文中例子|文中範例|原文引述|原文範例|引文|引述|範例|原文)[:：]/,
};

function stripZhConceptPrefix(zh) {
  // First peel off the structural English labels the AI may leak (KEY IDEA:,
  // GRAMMAR:, FUNCTION:, USE IT:, FROM THE TEXT:, etc.) via the shared
  // helper, then strip the StyleLab-specific Chinese concept labels
  // (文法：、功能：、試著使用：、文中引述：) and any of their nested variants.
  let out = stripRedundantPrefix(zh);
  for (let i = 0; i < 3; i++) {
    let next = out;
    for (const re of Object.values(ZH_CONCEPT_LABELS)) next = next.replace(re, "");
    next = next.trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

function parseConceptTranslation(result) {
  if (!result) return {};
  // parseTranslationPairs handles both the JSON output (preferred) and the
  // legacy EN/ZH text fallback, so this routing logic doesn't care which
  // shape the model returned.
  const pairs = parseTranslationPairs(result);

  const slots = { grammar: "", function: "", useIt: "", example: "" };

  // Pass 1: route by explicit label (English side preferred, Chinese side fallback)
  for (const p of pairs) {
    let key = null;
    if (/^GRAMMAR\b/i.test(p.en)) key = "grammar";
    else if (/^FUNCTION\b/i.test(p.en)) key = "function";
    else if (/^USE\s+IT\b/i.test(p.en)) key = "useIt";
    else if (/^FROM\s+THE\s+TEXT\b/i.test(p.en)) key = "example";
    else if (ZH_CONCEPT_LABELS.grammar.test(p.zh)) key = "grammar";
    else if (ZH_CONCEPT_LABELS.function.test(p.zh)) key = "function";
    else if (ZH_CONCEPT_LABELS.useIt.test(p.zh)) key = "useIt";
    else if (ZH_CONCEPT_LABELS.example.test(p.zh)) key = "example";
    if (key && !slots[key]) slots[key] = stripZhConceptPrefix(p.zh);
  }

  // Pass 2: positional fallback — buildConceptTranslateInput emits sections in
  // the order GRAMMAR → FUNCTION → USE IT → FROM THE TEXT, and the model
  // preserves order, so unrouted pairs fill remaining slots in that order.
  const order = ["grammar", "function", "useIt", "example"];
  const labelRe = /^(GRAMMAR|FUNCTION|USE\s+IT|FROM\s+THE\s+TEXT)\b/i;
  const allZhRegexes = Object.values(ZH_CONCEPT_LABELS);
  const unrouted = pairs.filter(p => p.zh && !labelRe.test(p.en) && !allZhRegexes.some(re => re.test(p.zh)));
  let idx = 0;
  for (const slot of order) {
    if (!slots[slot] && unrouted[idx]) {
      slots[slot] = stripZhConceptPrefix(unrouted[idx].zh);
      idx++;
    }
  }

  return slots;
}

function SavedConceptCard({ concept, isExpanded, onToggle, onRemove }) {
  const [translation, setTranslation] = useState(null); // { grammar, function, useIt, example }
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);

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
      const result = await callAI(translatePrompt, input, false, 2000, route.thinkingBudget, undefined, undefined, route.model, TRANSLATE_SCHEMA);
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

function SavedConcepts() {
  const [concepts, setConcepts] = useState(() => JSON.parse(localStorage.getItem("lyra-saved-concepts") || "[]"));
  const [expanded, setExpanded] = useState(null);

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

  return (
    <div>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 12, fontFamily: mono }}>
        {concepts.length} saved concept{concepts.length !== 1 ? "s" : ""}
      </div>
      {concepts.map((c, i) => (
        <SavedConceptCard
          key={i}
          concept={c}
          isExpanded={expanded === i}
          onToggle={() => setExpanded(expanded === i ? null : i)}
          onRemove={() => remove(i)}
        />
      ))}
    </div>
  );
}

export function SavedSkills({ onCountChange, onApply, onPractice }) {
  const [skills, setSkills] = useState(() => {
    const s = JSON.parse(localStorage.getItem("lyra-style-skills") || "[]");
    if (onCountChange) setTimeout(() => onCountChange(s.length), 0);
    return s;
  });
  const [expanded, setExpanded] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editName, setEditName] = useState("");

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
    if (expanded === idx) setExpanded(null);
    if (onCountChange) onCountChange(next.length);
  };

  if (skills.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <FeatherIcon size={24} color={COLORS.accent2} />
        <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 12, lineHeight: 1.5, fontFamily: mono }}>
          No style skills yet. Analyse a passage to save your first skill.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 12, fontFamily: mono }}>
        {skills.length} skill{skills.length !== 1 ? "s" : ""} saved
      </div>
      {skills.map((sk, i) => (
        <div key={sk.id} style={{ background: COLORS.card, borderTop: `1px solid ${expanded === i ? (sk.type === "researched" ? COLORS.blue : COLORS.accent1) : COLORS.border}`, borderRight: `1px solid ${expanded === i ? (sk.type === "researched" ? COLORS.blue : COLORS.accent1) : COLORS.border}`, borderBottom: `1px solid ${expanded === i ? (sk.type === "researched" ? COLORS.blue : COLORS.accent1) : COLORS.border}`, borderLeft: `3px solid ${sk.type === "researched" ? COLORS.blue : COLORS.accent1}`, borderRadius: 14, marginBottom: 10, overflow: "hidden", transition: "border-color 0.2s" }}>
          <div
            onClick={() => setExpanded(expanded === i ? null : i)}
            style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, fontFamily: mono }}>{sk.authorName}</div>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingIdx(i); setEditName(sk.authorName); }}
                    title="Rename skill"
                    style={{ background: "none", border: "none", fontSize: 11, color: COLORS.muted, cursor: "pointer", padding: "1px 4px", opacity: 0.5, lineHeight: 1 }}
                  >✎</button>
                </div>
              )}
              {sk.signatureStyle && (
                <div style={{ fontSize: 10, color: COLORS.muted, fontFamily: mono, marginTop: 2 }}>{sk.signatureStyle.slice(0, 60)}{sk.signatureStyle.length > 60 ? "..." : ""}</div>
              )}
            </div>
            <span style={{ fontSize: 10, color: COLORS.muted, transform: expanded === i ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>&#9654;</span>
          </div>
          {expanded === i && (
            <div style={{ padding: "0 14px 14px", fontFamily: mono }}>
              {sk.signatureStyle && sk.type !== "researched" && sk.type !== "analysed" && (
                <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 8, background: "#EDE8E0", borderRadius: 8, padding: "8px 10px" }}>
                  <span style={{ fontWeight: 700, color: COLORS.heading }}>Signature: </span>{sk.signatureStyle}
                </div>
              )}
              {sk.researchedTechniques?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                  {sk.researchedTechniques.map((t, j) => (
                    <div key={j} style={{ background: COLORS.bg2, borderRadius: 10, padding: "10px 12px", borderLeft: `3px solid ${COLORS.blue}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.heading, marginBottom: 4 }}>
                        <span style={{ color: COLORS.blue }}>✦</span> {t.technique}
                      </div>
                      {t.description && (
                        <div style={{ fontSize: 11, color: COLORS.text, lineHeight: 1.5, marginBottom: t.example ? 6 : 0 }}>
                          {t.description}
                        </div>
                      )}
                      {t.example && (
                        <div style={{ fontSize: 10, color: COLORS.muted, fontStyle: "italic", lineHeight: 1.5, borderLeft: `2px solid ${COLORS.blue}`, paddingLeft: 8, marginTop: 4 }}>
                          {t.example}
                        </div>
                      )}
                      {t.sourceUrl && (
                        <div style={{ marginTop: 4 }}>
                          <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: COLORS.blue, textDecoration: "none" }}>
                            {t.sourceName || "Source"} ↗
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : sk.analysedTechniques?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                  {sk.analysedTechniques.map((t, j) => (
                    <div key={j} style={{ background: COLORS.bg2, borderRadius: 10, padding: "10px 12px", borderLeft: `3px solid ${COLORS.accent1}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.heading, marginBottom: 4 }}>
                        <span style={{ color: COLORS.accent1 }}>&#9998;</span> {t.technique}
                      </div>
                      {t.description && (
                        <div style={{ fontSize: 11, color: COLORS.text, lineHeight: 1.5, marginBottom: 6 }}>
                          {t.description}
                        </div>
                      )}
                      {t.structure && (
                        <div style={{ background: "#F0EDE8", border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 8, padding: "8px 10px", marginBottom: t.example ? 6 : 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.accent1, marginBottom: 3, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>Try this pattern</div>
                          <div style={{ fontSize: 11, color: COLORS.heading, lineHeight: 1.5, fontFamily: mono }}>{t.structure}</div>
                        </div>
                      )}
                      {t.example && (
                        <div style={{ fontSize: 10, color: COLORS.muted, fontStyle: "italic", lineHeight: 1.5, borderLeft: `2px solid ${COLORS.accent1}`, paddingLeft: 8, marginTop: 4 }}>
                          {t.example}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : sk.techniques && sk.techniques.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {sk.techniques.map((t, j) => (
                    <span key={j} style={{ fontSize: 10, fontFamily: mono, background: COLORS.bg2, padding: "3px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, color: COLORS.heading }}>{t}</span>
                  ))}
                </div>
              ) : null}
              {sk.whenToUse?.keyIdea && (
                <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 8, background: "#E8E3DB", borderRadius: 8, padding: "8px 10px" }}>
                  <span style={{ fontWeight: 700, color: COLORS.heading }}>When to use: </span>{sk.whenToUse.keyIdea}
                </div>
              )}
              {sk.whenToUse?.bullets?.length > 0 && (
                <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, marginBottom: 8, paddingLeft: 8 }}>
                  {sk.whenToUse.bullets.map((b, j) => <div key={j}>• {b}</div>)}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(i); }}
                  style={{ fontSize: 10, fontFamily: mono, padding: "4px 10px", borderRadius: 8, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, cursor: "pointer" }}
                >
                  Remove
                </button>
                {onPractice && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPractice(sk); }}
                    style={{ fontSize: 12, fontFamily: mono, padding: "8px 14px", borderRadius: 10, border: `1.5px solid ${COLORS.green}`, background: "transparent", color: COLORS.green, cursor: "pointer", fontWeight: 700, letterSpacing: 0.3, transition: "all 0.2s" }}
                  >
                    Practice
                  </button>
                )}
                {onApply && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onApply(sk); }}
                    style={{ flex: 1, fontSize: 12, fontFamily: mono, padding: "8px 16px", borderRadius: 10, border: "none", background: COLORS.heading, color: "#fff", cursor: "pointer", fontWeight: 700, letterSpacing: 0.3, transition: "all 0.2s" }}
                  >
                    ✦ Write with this skill
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function StyleLab({ showStyleLab, setShowStyleLab, trackCall, setAppliedSkill, onApplySkill, initialTab, onOpenTraining }) {
  const [activeTab, setActiveTab] = useState("analyze");

  // Jump to requested tab when StyleLab opens
  useEffect(() => {
    if (showStyleLab && initialTab) setActiveTab(initialTab);
    if (!showStyleLab) setActiveTab("analyze");
  }, [showStyleLab, initialTab]);
  const [referenceText, setReferenceText] = useState("");
  const [styleProfile, setStyleProfile] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [profileSections, setProfileSections] = useState([]);
  const [error, setError] = useState("");

  const [practiceMessages, setPracticeMessages] = useState([]);
  const [practiceInput, setPracticeInput] = useState("");
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [typingMsg, setTypingMsg] = useState(null);

  const [savedCount, setSavedCount] = useState(() => JSON.parse(localStorage.getItem("lyra-saved-concepts") || "[]").length);
  const [skillSaved, setSkillSaved] = useState(null); // null | "saved" | "too-short"
  const [skillCount, setSkillCount] = useState(() => JSON.parse(localStorage.getItem("lyra-style-skills") || "[]").length);

  const practiceEndRef = useRef(null);
  const analyseEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (practiceEndRef.current) {
      practiceEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [practiceMessages, typingMsg]);

  // Auto-scroll analyse tab as new sections stream in
  useEffect(() => {
    if (analyseEndRef.current && profileSections.length > 0) {
      analyseEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [profileSections]);

  const wordCount = referenceText.trim() ? referenceText.trim().split(/\s+/).length : 0;

  const resetAll = useCallback(() => {
    setReferenceText("");
    setStyleProfile("");
    setAnalyzing(false);
    setAuthorName("");
    setProfileSections([]);
    setError("");
    setPracticeMessages([]);
    setPracticeInput("");
    setTypingMsg(null);
    setActiveTab("analyze");
    setSkillSaved(null);
  }, []);

  const analyzeStyle = useCallback(async () => {
    if (!referenceText.trim() || referenceText.trim().split(/\s+/).length < 80) return;
    setAnalyzing(true);
    setError("");
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
            existingSkillsCtx = `\n\nCROSS-REFERENCE: The student has previously studied these techniques from other authors: ${skillList.join(", ")}. If this new text uses any of the SAME techniques, mention the connection: "This writer also uses [technique] (like in your previous analysis), but [how they use it differently]." Only mention genuine overlaps — do not force connections.`;
          }
        }
      } catch (e) { /* silent */ }
      const userMsg = referenceText + existingSkillsCtx;

      const analysisRoute = getRouteConfig("style_analysis");
      trackCall();
      const result = await callAI(styleProfilerPrompt, userMsg, false, 10000, analysisRoute.thinkingBudget, (partial) => {
        // Live-update as tokens stream in
        const author = extractAuthor(partial);
        if (author !== "Unknown Author") setAuthorName(author);
        const sections = parseProfileSections(partial);
        if (sections.length > 0) {
          setProfileSections(sections);
          setAnalyzing(false);
        }
      }, undefined, analysisRoute.model);
      if (!result || !result.trim()) {
        setError("No response received. Please check your API connection and try again.");
      } else {
        setStyleProfile(result);
        const author = extractAuthor(result);
        setAuthorName(author);
        const sections = parseProfileSections(result);
        if (sections.length === 0) {
          setProfileSections([{ title: "STYLE ANALYSIS", content: result }]);
        } else {
          setProfileSections(sections);
          const savedSkill = saveStyleSkill(author, sections);
          setSkillCount(JSON.parse(localStorage.getItem("lyra-style-skills") || "[]").length);
          setSkillSaved(savedSkill ? "saved" : "too-short");
        }
      }
    } catch (e) {
      console.error("Style Lab analysis error:", e);
      setError(e.message || "Analysis failed. Please try again.");
    }
    setAnalyzing(false);
  }, [referenceText, trackCall]);

  const sendPractice = useCallback(async (text) => {
    if (!text.trim() || !styleProfile) return;
    const userMsg = { role: "user", text: text.trim() };
    setPracticeMessages(prev => [...prev, userMsg]);
    setPracticeInput("");
    setPracticeLoading(true);
    setTypingMsg(null);
    try {
      const practiceRoute = getRouteConfig("practice_rewrite");
      trackCall();
      const result = await callAI(styleCoachPrompt(styleProfile, authorName), text.trim(), false, 6000, practiceRoute.thinkingBudget, undefined, undefined, practiceRoute.model);
      setPracticeLoading(false);
      setTypingMsg({ role: "ai", text: result, id: Date.now() });
    } catch (e) {
      setPracticeLoading(false);
      setPracticeMessages(prev => [...prev, { role: "ai", text: "Something went wrong. Please try again." }]);
    }
  }, [styleProfile, authorName, trackCall]);

  const handleTypingDone = useCallback((msg) => {
    setPracticeMessages(prev => [...prev, { role: "ai", text: msg.text }]);
    setTypingMsg(null);
  }, []);

  if (!showStyleLab) return null;

  const hasProfile = profileSections.length > 0;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, maxWidth: 430, margin: "0 auto", background: COLORS.bg1, zIndex: 100, display: "flex", flexDirection: "column", animation: "fadeIn 0.25s ease" }}>
      {/* Header */}
      <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${COLORS.border}`, background: COLORS.card, flexShrink: 0 }}>
        <button onClick={() => setShowStyleLab(false)} style={{ width: 32, height: 32, borderRadius: 16, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, color: COLORS.muted }}>
          &#x2190;
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 15, fontWeight: 700, color: COLORS.heading }}>Style Lab</div>
          <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono }}>
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
            { key: "practice", label: "Practice", needsProfile: true },
            { key: "useit", label: "Use It", needsProfile: true },
            { key: "saved", label: savedCount > 0 ? `Saved (${savedCount})` : "Saved" },
            { key: "skills", label: skillCount > 0 ? `Skills (${skillCount})` : "Skills" },
          ].map(t => {
            const disabled = t.needsProfile && !hasProfile;
            return (
              <button
                key={t.key}
                onClick={() => { if (disabled) return; setActiveTab(t.key); }}
                style={{
                  flex: 1, padding: "8px 16px", borderRadius: 17, border: "none",
                  background: activeTab === t.key ? COLORS.card : "transparent",
                  fontFamily: "'Courier Prime', monospace", fontSize: 11,
                  color: disabled ? COLORS.accent2 : (activeTab === t.key ? COLORS.heading : COLORS.muted),
                  fontWeight: activeTab === t.key ? 700 : 400,
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
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

                {skillSaved === "saved" && (
                  <div style={{ ...s.card, marginBottom: 12, padding: "10px 14px", borderLeft: `3px solid ${COLORS.green}`, background: "#F0F6F1", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>&#10003;</span>
                    <div style={{ fontSize: 11, color: COLORS.heading, fontFamily: mono, lineHeight: 1.5 }}>
                      <strong>Writing skill saved</strong> — check the Skills tab to review and reuse
                    </div>
                  </div>
                )}
                {skillSaved === "too-short" && (
                  <div style={{ ...s.card, marginBottom: 12, padding: "10px 14px", borderLeft: `3px solid ${COLORS.amber}`, background: "#FFF8EE" }}>
                    <div style={{ fontSize: 11, color: COLORS.heading, fontFamily: mono, lineHeight: 1.5 }}>
                      This passage wasn't detailed enough to generate a reusable writing skill. Try a longer passage (100+ words) with varied sentence structures.
                    </div>
                  </div>
                )}

                {/* Original text reference */}
                <details style={{ ...s.card, marginBottom: 12, padding: 0, cursor: "pointer" }}>
                  <summary style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono, listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 8, transition: "transform 0.2s" }}>&#9654;</span> Original text
                  </summary>
                  <div style={{ padding: "0 14px 12px", fontSize: 12, color: COLORS.text, lineHeight: 1.8, fontFamily: mono, fontStyle: "italic", borderTop: `1px solid ${COLORS.border}`, marginTop: 0, paddingTop: 10 }}>
                    {referenceText}
                  </div>
                </details>

                {/* Section cards (exclude WHEN TO USE — it has its own tab) */}
                {profileSections.filter(s => s.title !== "WHEN TO USE THIS STYLE").map((section, i) => (
                  <SectionCard key={i} section={section} onSave={() => setSavedCount(JSON.parse(localStorage.getItem("lyra-saved-concepts") || "[]").length)} />
                ))}
                <div ref={analyseEndRef} />

                <div style={{ textAlign: "center", marginTop: 16, marginBottom: 8 }}>
                  <button
                    onClick={() => setActiveTab("practice")}
                    style={{ ...s.btn, padding: "12px 32px" }}
                  >
                    Start Practising
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* USE IT TAB */}
        {activeTab === "useit" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
            {(() => {
              const useItSection = profileSections.find(s => s.title === "WHEN TO USE THIS STYLE");
              if (!useItSection) return <div style={{ textAlign: "center", padding: 40, color: COLORS.muted, fontFamily: mono, fontSize: 12 }}>Run an analysis first to see when to use this style.</div>;
              const parts = parseSectionContent(useItSection.content);
              // Parse bullet points from body text
              const bodyText = (parts.body || "") + "\n" + (useItSection.content || "");
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
            <SavedSkills onCountChange={setSkillCount} onApply={onApplySkill ? (skill) => {
              onApplySkill(skill);
              setShowStyleLab(false);
            } : null} onPractice={onOpenTraining ? (skill) => {
              setShowStyleLab(false);
              onOpenTraining(skill);
            } : null} />
          </div>
        )}

        {/* PRACTICE TAB */}
        {activeTab === "practice" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
              {/* Original passage reference */}
              {referenceText && (
                <details style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, borderRight: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.accent2}`, borderRadius: 10, marginBottom: 14, padding: 0, cursor: "pointer" }}>
                  <summary style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono, listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 8 }}>&#9654;</span> Original passage{authorName && authorName !== "Unknown Author" ? ` — ${authorName}` : ""}
                  </summary>
                  <div style={{ padding: "0 12px 10px", fontSize: 11, color: COLORS.text, lineHeight: 1.7, fontFamily: mono, fontStyle: "italic", borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, maxHeight: 150, overflowY: "auto" }}>
                    {referenceText}
                  </div>
                </details>
              )}

              {practiceMessages.length === 0 && !typingMsg && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <FeatherIcon size={24} color={COLORS.accent2} />
                  <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 12, lineHeight: 1.5, fontFamily: mono }}>
                    Type a sentence and Lyra will rewrite it in{authorName && authorName !== "Unknown Author" ? ` ${authorName}'s` : " the analysed"} style, explaining every technique used.
                  </div>
                </div>
              )}

              {practiceMessages.map((msg, i) => (
                msg.role === "user" ? (
                  <div key={i} style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                    <div style={{ background: COLORS.heading, color: "#fff", borderRadius: "18px 18px 4px 18px", padding: "10px 16px", fontSize: 13, lineHeight: 1.6, maxWidth: "85%", whiteSpace: "pre-wrap", fontFamily: mono }}>
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <div style={{ marginTop: 4 }}><FeatherIcon size={16} /></div>
                    <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", maxWidth: "85%", fontFamily: mono }}>
                      <CoachMessage text={msg.text} profileSections={profileSections} />
                    </div>
                  </div>
                )
              ))}

              {typingMsg && (
                <PracticeTypingBubble msg={typingMsg} onDone={handleTypingDone} />
              )}

              {practiceLoading && !typingMsg && (
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <div style={{ marginTop: 4 }}><FeatherIcon size={16} /></div>
                  <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", fontSize: 13, fontFamily: mono }}>
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      <span style={{ animation: "bounce 1s infinite 0s" }}>.</span>
                      <span style={{ animation: "bounce 1s infinite 0.15s" }}>.</span>
                      <span style={{ animation: "bounce 1s infinite 0.3s" }}>.</span>
                    </span>
                  </div>
                </div>
              )}

              <div ref={practiceEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px 18px 16px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.card, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={inputRef}
                  value={practiceInput}
                  onChange={e => setPracticeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && practiceInput.trim() && !practiceLoading) sendPractice(practiceInput); }}
                  placeholder="Type a sentence to transform..."
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: "'Courier Prime', monospace", fontSize: 13, color: COLORS.text, outline: "none" }}
                />
                <button
                  onClick={() => { if (practiceInput.trim() && !practiceLoading) sendPractice(practiceInput); }}
                  disabled={!practiceInput.trim() || practiceLoading}
                  style={{ width: 40, height: 40, borderRadius: 20, border: "none", background: practiceInput.trim() && !practiceLoading ? COLORS.heading : COLORS.bg3, color: "#fff", fontSize: 16, cursor: practiceInput.trim() && !practiceLoading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
                >
                  &#x2192;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
