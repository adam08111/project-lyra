import { useState } from "react";
import { COLORS } from "../constants.js";
import { FeatherIcon } from "./Icons.jsx";
import { callAI } from "../api.js";
import { getRouteConfig } from "../ai-router.js";
import { translatePrompt } from "../prompts.js";

// ── Shared font ──
export const mono = "'Courier Prime', 'Courier New', monospace";

// ── Parsing helpers ──

export function parseProfileSections(text) {
  const sections = [];
  const lines = text.split("\n");
  let currentTitle = null;
  let currentContent = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const sectionHeaders = ["COMPARING AND DESCRIBING", "SENTENCE PATTERNS", "HOW IDEAS ARE CONNECTED", "WORD CHOICES", "GRAMMAR TRICKS", "HOW THE WRITER PERSUADES", "FEELING AND PERSONALITY", "WHEN TO USE THIS STYLE", "SIGNATURE STYLE"];
    const isHeader = sectionHeaders.some(h => trimmed === h);
    const isAuthor = trimmed.startsWith("AUTHOR:");

    if (isAuthor) continue;

    if (isHeader) {
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
      }
      currentTitle = trimmed;
      currentContent = [];
    } else if (currentTitle) {
      currentContent.push(line);
    }
  }
  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
  }
  return sections;
}

export function parseSectionContent(content) {
  const parts = { keyIdea: "", body: "", example: "", breakdown: "", whyItWorks: "", structure: "", watchOut: "", vocabUpgrade: "" };
  const lines = content.split("\n");
  let current = "body";

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip DIFFICULTY lines entirely — students don't need this label
    if (trimmed.startsWith("DIFFICULTY:")) continue;
    if (trimmed.startsWith("KEY IDEA:")) {
      parts.keyIdea = trimmed.replace("KEY IDEA:", "").trim();
      current = "body";
    } else if (trimmed.startsWith("FROM THE TEXT:") || trimmed.startsWith("EXAMPLE:")) {
      parts.example = trimmed.replace(/^(FROM THE TEXT:|EXAMPLE:)/, "").trim();
      current = "example";
    } else if (trimmed.startsWith("BREAKDOWN:")) {
      parts.breakdown = trimmed.replace("BREAKDOWN:", "").trim();
      current = "breakdown";
    } else if (trimmed.startsWith("WHY IT WORKS:")) {
      parts.whyItWorks = trimmed.replace("WHY IT WORKS:", "").trim();
      current = "why";
    } else if (trimmed.startsWith("STRUCTURE:")) {
      parts.structure = trimmed.replace("STRUCTURE:", "").trim();
      current = "structure";
    } else if (trimmed.startsWith("WATCH OUT:")) {
      parts.watchOut = trimmed.replace("WATCH OUT:", "").trim();
      current = "watchOut";
    } else if (trimmed.startsWith("WRITER'S WORDS:") || trimmed.startsWith("WRITER\u2019S WORDS:") || trimmed.startsWith("VOCAB UPGRADE:")) {
      parts.vocabUpgrade = trimmed.replace(/(?:WRITER[''\u2019]S WORDS|VOCAB UPGRADE):/, "").trim();
      current = "vocab";
    } else if (trimmed) {
      if (current === "body") parts.body += (parts.body ? "\n" : "") + trimmed;
      else if (current === "example") parts.example += " " + trimmed;
      else if (current === "breakdown") parts.breakdown += " " + trimmed;
      else if (current === "why") parts.whyItWorks += " " + trimmed;
      else if (current === "structure") parts.structure += " " + trimmed;
      else if (current === "watchOut") parts.watchOut += " " + trimmed;
      else if (current === "vocab") parts.vocabUpgrade += " " + trimmed;
    }
  }
  return parts;
}

// Parse annotated text like: "He {went to school}[past tense] yesterday"
export function parseAnnotations(text) {
  if (!text) return [{ text }];
  const parts = [];
  const pattern = /\{([^}]+)\}\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index) });
    }
    parts.push({ text: match[1], label: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) });
  }
  return parts.length > 0 ? parts : [{ text }];
}

export const ANNOTATION_COLORS = [
  { text: "#8B5E3C", bg: "rgba(139, 94, 60, 0.10)", border: "#8B5E3C" },
  { text: "#5A7E8B", bg: "rgba(90, 126, 139, 0.10)", border: "#5A7E8B" },
  { text: "#7B6B8A", bg: "rgba(123, 107, 138, 0.10)", border: "#7B6B8A" },
  { text: "#6B8A5A", bg: "rgba(107, 138, 90, 0.10)", border: "#6B8A5A" },
  { text: "#8A6B6B", bg: "rgba(138, 107, 107, 0.10)", border: "#8A6B6B" },
];

export function labelColorIndex(label) {
  let hash = 0;
  const lower = label.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    hash = ((hash << 5) - hash) + lower.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % ANNOTATION_COLORS.length;
}

export function AnnotatedQuote({ text }) {
  const segments = parseAnnotations(text);
  const hasAnnotations = segments.some(s => s.label);

  if (!hasAnnotations) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {segments.map((seg, i) => {
        if (!seg.label) return <span key={i}>{seg.text}</span>;
        const c = ANNOTATION_COLORS[labelColorIndex(seg.label)];
        return (
          <ruby key={i} style={{
            background: c.bg,
            borderBottom: `2px solid ${c.border}`,
            borderRadius: 3,
            padding: "0 2px",
            rubyPosition: "over",
          }}>
            {seg.text}
            <rp>(</rp>
            <rt style={{
              fontSize: 10,
              fontWeight: 700,
              color: c.text,
              textTransform: "lowercase",
              letterSpacing: 0.5,
              fontStyle: "normal",
              fontFamily: mono,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}>
              {seg.label}
            </rt>
            <rp>)</rp>
          </ruby>
        );
      })}
    </span>
  );
}

// Parse translation output into [{ en, zh }] pairs.
// Handles TWO output formats:
//   A) Strict EN/ZH pair format (per prompt instructions):
//      EN: ...
//      ZH: ...
//   B) Hybrid format the AI sometimes uses — English source labels preserved
//      followed by Chinese content directly:
//      KEY IDEA: 作者使用...
//      FROM THE TEXT: 「...」
//      BREAKDOWN: PLAIN MEANING: ...
function parseTranslationPairs(text) {
  if (!text) return [];

  const isHiddenPair = (en, zh) => {
    if (!en && !zh) return true;
    if (en && /^DIFFICULTY\b/i.test(en.trim())) return true;
    if (zh && /^難度[:：]/.test(zh.trim())) return true;
    return false;
  };

  // === Format A: scan for EN:/ZH: markers anywhere in the text ===
  // Robust against missing blank lines between pairs, or pairs on a single line.
  const formatAPairs = (() => {
    const re = /(^|\n)\s*(EN|ZH)\s*[:：]\s*/g;
    const markers = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      const labelStart = m.index + m[1].length;
      markers.push({ type: m[2].toUpperCase(), labelStart, contentStart: m.index + m[0].length });
    }
    if (markers.length === 0) return [];
    const sections = markers.map((mk, i) => ({
      type: mk.type,
      content: text.slice(mk.contentStart, i + 1 < markers.length ? markers[i + 1].labelStart : text.length).trim(),
    }));
    const pairs = [];
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].type === "EN" && i + 1 < sections.length && sections[i + 1].type === "ZH") {
        pairs.push({ en: sections[i].content, zh: sections[i + 1].content });
        i++;
      }
    }
    return pairs.filter(p => (p.en || p.zh) && !isHiddenPair(p.en, p.zh));
  })();

  // If we got real EN/ZH pairs, use them
  if (formatAPairs.length > 0 && formatAPairs.some(p => p.en && p.zh)) {
    return formatAPairs;
  }

  // === Format B: English labels + Chinese content (no EN:/ZH: prefixes) ===
  // Split the text into chunks at known English source labels.
  // Each chunk becomes a synthetic pair: en = "LABEL: ..."  zh = <Chinese content>
  // This lets the existing en-label router work correctly.
  const labelPattern = /(KEY\s+IDEA|FROM\s+THE\s+TEXT|EXAMPLE|BREAKDOWN|PLAIN\s+MEANING|GRAMMAR|FUNCTION|USE\s+IT|WHY\s+IT\s+WORKS|STRUCTURE|TRY\s+THIS\s+PATTERN|WRITER['’]?S\s+WORDS|VOCAB\s+UPGRADE|WATCH\s+OUT|DIFFICULTY)\s*[:：]/gi;

  // Find all label matches with their positions
  const matches = [];
  let m;
  while ((m = labelPattern.exec(text)) !== null) {
    matches.push({ label: m[1].toUpperCase().replace(/\s+/g, " "), start: m.index, end: m.index + m[0].length });
  }

  if (matches.length === 0) return formatAPairs; // give up, return whatever we had

  const pairs = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].start : text.length;
    let content = text.slice(cur.end, nextStart).trim().replace(/^[|｜]\s*/, "").replace(/\s*[|｜]\s*$/, "");
    // If the AI inlined an EN/ZH separator inside the section, take only the ZH portion
    const inlineZh = content.match(/(?:^|\n|\s)\s*ZH\s*[:：]\s*([\s\S]+)$/);
    if (inlineZh) content = inlineZh[1].trim();
    // Strip a leading "EN:" if the captured content starts with it
    content = content.replace(/^\s*EN\s*[:：]\s*/, "").trim();
    if (!content) continue;
    const synthPair = { en: `${cur.label}: ${content}`, zh: content };
    if (!isHiddenPair(synthPair.en, synthPair.zh)) pairs.push(synthPair);
  }

  return pairs.length > 0 ? pairs : formatAPairs;
}

// Group pairs by which sub-section their EN sentence came from.
// Falls back to "body" for unmatched pairs.
function groupPairsBySource(pairs, sources) {
  // English-side section labels — these MUST match the exact labels used in
  // styleProfilerPrompt (section.content), NOT the rendered UI labels.
  // Source labels: KEY IDEA, FROM THE TEXT, BREAKDOWN (with sub-parts PLAIN MEANING,
  // GRAMMAR, FUNCTION, USE IT), WHY IT WORKS, STRUCTURE, WATCH OUT, WRITER'S WORDS.
  const enLabelMap = [
    { regex: /^FROM\s+THE\s+TEXT\b/i, bucket: "example" },
    { regex: /^(BREAKDOWN|PLAIN\s+MEANING|GRAMMAR|FUNCTION|USE\s+IT)\b/i, bucket: "breakdown" },
    { regex: /^WHY\s+IT\s+WORKS\b/i, bucket: "whyItWorks" },
    // STRUCTURE is the source label; "TRY THIS PATTERN" is only the UI label
    { regex: /^(STRUCTURE|TRY\s+THIS\s+PATTERN)\b/i, bucket: "structure" },
    { regex: /^(WRITER['’]?S\s+WORDS|VOCAB\s+UPGRADE)\b/i, bucket: "vocabUpgrade" },
    { regex: /^KEY\s+IDEA\b/i, bucket: "keyIdea" },
    { regex: /^DIFFICULTY\b/i, bucket: "body" },
    { regex: /^WATCH\s+OUT\b/i, bucket: "watchOut" },
  ];

  // Chinese-side labels — many synonyms because the AI translates the labels
  // differently across runs (文中引述 / 文中節錄 / 文中摘錄 all = "FROM THE TEXT").
  const zhLabelMap = [
    { regex: /^(文中引述|文中例子|文中範例|文中節錄|文中摘錄|原文引述|原文摘錄|原文範例|節錄|摘錄|引文|引述|範例|原文)/, bucket: "example" },
    { regex: /^(解析|解構|句子解構|句子解析|句子分析|分析|分解|拆解|細部分析|淺白解釋|淺白意義|簡單來說|簡單意思|文法|文法模式|文法結構|語法|語法模式|句法|功能|作用|試著使用|試試看|嘗試一下|請試試|練習)/, bucket: "breakdown" },
    { regex: /^(為什麼有效|為何有效|為何重要|此寫法的效果|為什麼這樣寫|效用)/, bucket: "whyItWorks" },
    { regex: /^(結構|句型結構|寫作結構|句型範本|範本|句式|句型|嘗試這個模式|試試這個模式|試試此模式|套用範本|套用模板|模式)/, bucket: "structure" },
    { regex: /^(作者用詞|作者的用語|作者選詞|作家用詞|寫作用詞|寫作詞彙|詞彙升級|用詞升級)/, bucket: "vocabUpgrade" },
    { regex: /^(主要想法|關鍵想法|重點想法|核心概念|核心想法|關鍵概念|主要概念|主旨)/, bucket: "keyIdea" },
    { regex: /^(難度)/, bucket: "body" },
    { regex: /^(注意|小心|警告|常見錯誤|要注意)/, bucket: "watchOut" },
  ];

  const groups = {};
  const fallback = "body";
  for (const pair of pairs) {
    let bucket = null;

    // 1. Check English-side label
    if (pair.en) {
      for (const { regex, bucket: b } of enLabelMap) {
        if (regex.test(pair.en.trim())) {
          bucket = b;
          break;
        }
      }
    }

    // 2. Check Chinese-side label (when AI translated the label into Chinese)
    if (!bucket && pair.zh) {
      for (const { regex, bucket: b } of zhLabelMap) {
        if (regex.test(pair.zh.trim())) {
          bucket = b;
          break;
        }
      }
    }

    // 3. Fall back to substring matching against source content
    if (!bucket && pair.en) {
      // Strip leading quotes/punctuation so probes like '"For them..."' match parts.example
      const cleaned = pair.en.replace(/^[\s"'“”‘’\[\(]+/, "");
      const probe = cleaned.split(/\s+/).slice(0, 5).join(" ").toLowerCase();
      for (const [name, source] of Object.entries(sources)) {
        if (source && probe.length > 5 && source.toLowerCase().includes(probe)) {
          bucket = name;
          break;
        }
      }
    }

    if (!bucket) bucket = fallback;
    if (!groups[bucket]) groups[bucket] = [];
    groups[bucket].push(pair);
  }

  // Fallback: if keyIdea bucket is still empty but we have a keyIdea source,
  // find any pair whose EN contains a chunk of the keyIdea text and route it there.
  // This rescues cases where the AI omits the "KEY IDEA:" label in output.
  if (!groups.keyIdea && sources.keyIdea) {
    // Try multiple probe lengths and offsets
    const tokens = sources.keyIdea.split(/\s+/).filter(Boolean);
    const probes = [
      tokens.slice(0, 4).join(" ").toLowerCase(),
      tokens.slice(0, 3).join(" ").toLowerCase(),
      tokens.slice(0, 2).join(" ").toLowerCase(),
    ].filter(p => p.length > 5);

    outer: for (const probe of probes) {
      for (const [, list] of Object.entries(groups)) {
        const idx = list.findIndex(p => p.en && p.en.toLowerCase().includes(probe));
        if (idx >= 0) {
          groups.keyIdea = [list[idx]];
          list.splice(idx, 1);
          break outer;
        }
      }
    }
  }

  // Last resort: if STILL empty and there are pairs, take the first one as keyIdea.
  // The AI translates in source order, so the first pair is almost always the heading.
  if (!groups.keyIdea && sources.keyIdea && pairs.length > 0) {
    for (const [, list] of Object.entries(groups)) {
      if (list.length > 0) {
        groups.keyIdea = [list[0]];
        list.splice(0, 1);
        break;
      }
    }
  }

  return groups;
}

export function SectionCard({ section, onSave, trackCall, index }) {
  const parts = parseSectionContent(section.content);
  const hasStructure = parts.keyIdea || parts.example;
  const [savedLabel, setSavedLabel] = useState(null);
  const [translation, setTranslation] = useState(""); // cached result
  const [showTranslation, setShowTranslation] = useState(false); // visibility toggle
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    if (translating) return;
    // Toggle: if already showing, hide. If hidden but cached, show. Otherwise fetch.
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    if (translation) {
      setShowTranslation(true);
      return;
    }
    setTranslating(true);
    try {
      const route = getRouteConfig("translate");
      if (trackCall) trackCall();
      const result = await callAI(translatePrompt, section.content, false, 4000, route.thinkingBudget, undefined, undefined, route.model);
      setTranslation(result || "");
      setShowTranslation(true);
    } catch (e) {
      setTranslation("翻譯失敗，請再試一次。");
      setShowTranslation(true);
    }
    setTranslating(false);
  };

  // Distribute translation pairs across sub-sections by matching EN sentences to source
  const grouped = (showTranslation && translation)
    ? groupPairsBySource(parseTranslationPairs(translation), {
        keyIdea: parts.keyIdea,
        body: parts.body,
        example: parts.example,
        breakdown: parts.breakdown,
        whyItWorks: parts.whyItWorks,
        structure: parts.structure,
      })
    : {};

  // Render helper: show ONLY the Chinese translation right beneath each sub-section.
  // The English is already visible above in the sub-section itself, so we don't repeat it here.
  // Also strip redundant section-label prefixes (解析、文中例子 etc.) since the parent
  // sub-section already labels itself in English.
  // Strip any leading Chinese-label prefix so it doesn't appear DOUBLED next
  // to the English label rendered ahead of it. The pattern catches ANY 1-10
  // Chinese-character label followed by a colon — universal, no list to maintain.
  // Examples it strips: 為何有效：/ 結構：/ 注意事項：/ 文中節錄：/ 簡單意思： etc.
  // Applied repeatedly in case the AI nests labels (e.g. 解析：簡單意思：xxx).
  const stripRedundantPrefix = (zh) => {
    let out = zh;
    for (let i = 0; i < 3; i++) {
      const next = out.replace(/^[一-龥]{1,10}[:：]\s*/, "");
      if (next === out) break;
      out = next;
    }
    return out.trim();
  };
  // Map bucket key → English label prefix shown before the Chinese content
  const bucketLabels = {
    keyIdea: "KEY IDEA",
    whyItWorks: "WHY IT WORKS",
    vocabUpgrade: "WRITER'S WORDS",
    watchOut: "WATCH OUT",
  };

  const renderPairs = (key) => {
    const pairs = grouped[key];
    if (!pairs || pairs.length === 0) return null;
    const zhLines = pairs.map(p => stripRedundantPrefix(p.zh || "")).filter(Boolean);
    if (zhLines.length === 0) return null;
    // The keyIdea bucket gets the same bold + numbered treatment as the English heading above it
    const isKeyIdea = key === "keyIdea";
    const labelPrefix = bucketLabels[key];
    return (
      <div style={{ marginTop: isKeyIdea ? 4 : 8, marginBottom: isKeyIdea ? 14 : 12, paddingTop: 6 }}>
        {zhLines.map((zh, i) => (
          <div key={i} style={{
            fontSize: isKeyIdea ? 13 : 12,
            fontWeight: isKeyIdea ? 700 : 400,
            color: COLORS.heading,
            lineHeight: isKeyIdea ? 1.6 : 1.8,
            marginBottom: 4,
            fontFamily: mono,
          }}>
            {isKeyIdea && index ? `${index}. ` : ""}
            {labelPrefix && i === 0 ? <span style={{ fontWeight: 700 }}>{labelPrefix}: </span> : null}
            {zh}
          </div>
        ))}
      </div>
    );
  };

  // Combined renderer: keyIdea Chinese (bold + numbered) THEN body Chinese (plain), one block.
  // The keyIdea translation appears at the start of the body translation block — after the
  // English heading + English body, students see the full Chinese summary in one place.
  const renderKeyIdeaAndBody = () => {
    const keyIdeaLines = (grouped.keyIdea || [])
      .map(p => stripRedundantPrefix(p.zh || ""))
      .filter(Boolean);
    const bodyLines = (grouped.body || [])
      .map(p => stripRedundantPrefix(p.zh || ""))
      .filter(Boolean);
    if (keyIdeaLines.length === 0 && bodyLines.length === 0) return null;
    return (
      <div style={{ marginTop: 8, marginBottom: 12, paddingTop: 6 }}>
        {keyIdeaLines.map((zh, i) => (
          <div key={`k${i}`} style={{
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.heading,
            lineHeight: 1.6,
            marginBottom: 8,
            fontFamily: mono,
          }}>
            {index ? `${index}. ` : ""}<span>KEY IDEA: </span>{zh}
          </div>
        ))}
        {bodyLines.map((zh, i) => (
          <div key={`b${i}`} style={{
            fontSize: 12,
            fontWeight: 400,
            color: COLORS.heading,
            lineHeight: 1.8,
            marginBottom: 4,
            fontFamily: mono,
          }}>
            {zh}
          </div>
        ))}
      </div>
    );
  };

  // Dedicated renderer for the FROM THE TEXT translation — shows the Chinese quote
  // in a styled box that visually mirrors the English annotated-quote card above it.
  const renderExampleTranslation = () => {
    const pairs = grouped.example || [];
    if (pairs.length === 0) return null;
    const zhLines = pairs
      .map(p => stripRedundantPrefix(p.zh || ""))
      .filter(Boolean);
    if (zhLines.length === 0) return null;
    return (
      <div style={{ background: COLORS.bg2, borderRadius: 10, padding: "10px 14px", marginTop: 6, marginBottom: 12, borderLeft: `3px solid ${COLORS.accent1}`, fontFamily: mono }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
          翻譯 · Translation
        </div>
        {zhLines.map((zh, i) => (
          <div key={i} style={{ fontSize: 12, color: COLORS.heading, lineHeight: 2.1, fontStyle: "italic", marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontStyle: "normal" }}>FROM THE TEXT: </span>
            <AnnotatedQuote text={zh} />
          </div>
        ))}
      </div>
    );
  };

  // Dedicated renderer for the STRUCTURE / TRY THIS PATTERN translation.
  // Splits the Chinese on the arrow so the example portion renders in its
  // own cream-coloured card (matching the English version's treatment).
  const renderStructureTranslation = () => {
    const pairs = grouped.structure || [];
    if (pairs.length === 0) return null;
    const joined = pairs.map(p => stripRedundantPrefix(p.zh || "")).filter(Boolean).join(" ");
    if (!joined) return null;
    const m = joined.match(/^([\s\S]+?)\s*(?:→|→|->)\s*([\s\S]+)$/);
    const template = m ? m[1].trim() : joined;
    const example = m ? m[2].trim() : "";
    return (
      <div style={{ marginTop: 8, marginBottom: 12, paddingTop: 8, borderTop: `1px dashed ${COLORS.border}`, fontFamily: mono }}>
        <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.8 }}>
          <span style={{ fontWeight: 700 }}>STRUCTURE: </span>{template}
        </div>
        {example && (
          <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20", fontSize: 12, lineHeight: 1.7 }}>
            <span style={{ fontWeight: 700, color: "#A6701F" }}>For example: </span>{example}
          </div>
        )}
      </div>
    );
  };

  // Structured renderer for the SENTENCE BREAKDOWN translation — mirrors the English
  // breakdown card layout (bold labels, "Why use it" in shaded box, "Try it yourself"
  // in dashed box).
  const renderBreakdownTranslation = () => {
    const pairs = grouped.breakdown || [];
    if (pairs.length === 0) return null;

    // FAST PATH: route by pair.en label (works when Format B parser
    // produced synthetic pairs like { en: "PLAIN MEANING: ...", zh: "..." }).
    let plainFromPair = "", gramFromPair = "", funcFromPair = "", useItFromPair = "";
    for (const p of pairs) {
      const en = (p.en || "").trim();
      const zh = (p.zh || "").trim();
      if (/^PLAIN\s+MEANING\b/i.test(en)) plainFromPair = zh;
      else if (/^GRAMMAR\b/i.test(en)) gramFromPair = zh;
      else if (/^FUNCTION\b/i.test(en)) funcFromPair = zh;
      else if (/^USE\s+IT\b/i.test(en)) useItFromPair = zh;
    }
    // If pair routing got at least 2 slots, use it directly via shared variables
    const pairHitCount = [plainFromPair, gramFromPair, funcFromPair, useItFromPair].filter(Boolean).length;
    if (pairHitCount >= 2) {
      const plain = plainFromPair;
      const gram = gramFromPair;
      const func = funcFromPair;
      const useIt = useItFromPair;
      return (
        <div style={{ background: "#EDE8E0", borderRadius: 10, padding: "10px 14px", marginTop: 8, marginBottom: 12, fontFamily: mono }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>BREAKDOWN</div>
          {plain && (
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: COLORS.heading }}>PLAIN MEANING: </span>{plain}
            </div>
          )}
          {gram && (
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: COLORS.heading }}>GRAMMAR: </span>{gram}
            </div>
          )}
          {func && (
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6, background: "#E8E3DB", borderRadius: 8, padding: "8px 10px" }}>
              <span style={{ fontWeight: 700, color: COLORS.heading }}>FUNCTION: </span>{func}
            </div>
          )}
          {useIt && (() => {
            const m = useIt.match(/^([\s\S]+?)\s*(?:→|→|->)\s*([\s\S]+)$/);
            const template = m ? m[1].trim() : useIt;
            const example = m ? m[2].trim() : "";
            return (
              <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 8, padding: "8px 10px" }}>
                <span style={{ fontWeight: 700, color: COLORS.accent1 }}>USE IT: </span>{template}
                {example && (
                  <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20", fontSize: 12, lineHeight: 1.7 }}>
                    <span style={{ fontWeight: 700, color: "#A6701F" }}>For example: </span>{example}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      );
    }

    const allZh = pairs.map(p => p.zh || "").filter(Boolean).join("\n");
    if (!allZh.trim()) return null;

    // Strip any top-level wrapper label that introduces the breakdown.
    // The AI may invent its own wrapper (解析/概要/綜述/分析/句子解析/breakdown/etc).
    const body = allZh.replace(/^\s*(?:解析|概要|綜述|分析|句子解析|句子分析|細部解析|BREAKDOWN)[:：]\s*/i, "");

    // Label dictionaries — the AI uses many synonyms across sessions
    const plainLabels  = ["淺白解釋", "淺白意義", "淺白含義", "白話解釋", "白話翻譯", "白話意義",
                          "簡單來說", "簡單英文", "簡單英語", "簡單意思", "簡單含義", "簡明意思",
                          "基本意思", "基本含義", "主要意思", "直白意思", "字面意思", "字面含義",
                          "用簡單的話", "用簡單英文", "用淺白的話", "白話地說", "用平實的話",
                          "明白意思", "易懂的意思", "簡單版本"];
    const gramLabels   = ["文法", "語法", "文法模式", "語法模式", "文法結構", "語法結構", "句法",
                          "文法用法", "文法現象", "句子結構", "語法用法"];
    const funcLabels   = ["功能", "作用", "目的", "用途", "效用", "效果"];
    const useLabels    = ["試著使用", "試試看", "試試", "嘗試一下", "請試試", "練習", "自己試試",
                          "動手試試", "試著套用", "嘗試套用", "套用練習", "來試試", "套用模板",
                          "套用方法", "你也試試", "你來試試"];
    const allEndLabels = [...gramLabels, ...funcLabels, ...useLabels];

    // Build a regex that matches `${start}[:：]${content up to ${end} or eof}`
    // Whitespace, newlines, and pipe separators between segments are all valid boundaries.
    const grab = (startWords, endWords) => {
      const startPattern = startWords.join("|");
      const endPattern = endWords.length
        ? `(?=[\\s|｜]*(?:${endWords.join("|")})\\s*[:：])`
        : "$";
      const re = new RegExp(`(?:${startPattern})\\s*[:：]\\s*([\\s\\S]+?)${endPattern}`, "i");
      const m = body.match(re);
      return m?.[1]?.trim().replace(/[\s|｜]+$/, "");
    };

    let plain  = grab(plainLabels, allEndLabels);
    let gram   = grab(gramLabels, [...funcLabels, ...useLabels]);
    let func   = grab(funcLabels, useLabels);
    let useIt  = grab(useLabels, []);

    // Position-based fallback for any slot still empty.
    // Splits on ANY Chinese-character label (1-12 chars before a colon), so the
    // AI can use whatever Chinese terms it likes — we route by ORDER.
    if (!plain || !gram || !func || !useIt) {
      const segments = [];
      const segRe = /([一-龥]{1,12})[:：]\s*([\s\S]+?)(?=[\s|｜]*[一-龥]{1,12}[:：]|$)/g;
      let m;
      while ((m = segRe.exec(body)) !== null) {
        const label = m[1].trim();
        const text = m[2].trim().replace(/[\s|｜]+$/, "");
        // Filter out short wrapper-only labels with no actual content
        if (text && text.length > 1) segments.push({ label, text });
      }
      // Skip any leading wrapper-like label that introduces the section
      const wrapperRe = /^(解析|概要|綜述|分析|細部解析|句子解析|句子分析|內容解析)$/;
      const items = (segments[0] && wrapperRe.test(segments[0].label)) ? segments.slice(1) : segments;
      if (!plain  && items[0]) plain  = items[0].text;
      if (!gram   && items[1]) gram   = items[1].text;
      if (!func   && items[2]) func   = items[2].text;
      if (!useIt  && items[3]) useIt  = items[3].text;
    }

    if (!plain && !gram && !func && !useIt) {
      // Couldn't structurally parse — render raw lines as fallback
      return renderPairs("breakdown");
    }

    return (
      <div style={{ background: "#EDE8E0", borderRadius: 10, padding: "10px 14px", marginTop: 8, marginBottom: 12, fontFamily: mono }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>BREAKDOWN</div>
        {plain && (
          <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: COLORS.heading }}>PLAIN MEANING: </span>{plain}
          </div>
        )}
        {gram && (
          <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: COLORS.heading }}>GRAMMAR: </span>{gram}
          </div>
        )}
        {func && (
          <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6, background: "#E8E3DB", borderRadius: 8, padding: "8px 10px" }}>
            <span style={{ fontWeight: 700, color: COLORS.heading }}>FUNCTION: </span>{func}
          </div>
        )}
        {useIt && (() => {
          const m = useIt.match(/^([\s\S]+?)\s*(?:→|→|->)\s*([\s\S]+)$/);
          const template = m ? m[1].trim() : useIt;
          const example = m ? m[2].trim() : "";
          return (
            <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 8, padding: "8px 10px" }}>
              <span style={{ fontWeight: 700, color: COLORS.accent1 }}>USE IT: </span>{template}
              {example && (
                <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20", fontSize: 12, lineHeight: 1.7 }}>
                  <span style={{ fontWeight: 700, color: "#A6701F" }}>For example: </span>{example}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, borderRight: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.accent1}`, borderRadius: 14, marginBottom: 12, padding: 16, fontFamily: mono }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent1, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: mono }}>
          {section.title}
        </div>
        <button
          onClick={handleTranslate}
          disabled={translating}
          style={{ fontSize: 10, fontFamily: mono, padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${COLORS.border}`, background: translating ? COLORS.bg2 : COLORS.card, color: COLORS.heading, cursor: translating ? "default" : "pointer", letterSpacing: 0, fontWeight: 600, flexShrink: 0 }}
        >
          {translating ? "翻譯中..." : showTranslation ? "隱藏翻譯" : "翻譯成中文"}
        </button>
      </div>

      {hasStructure ? (
        <>
          {parts.keyIdea && (
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, lineHeight: 1.6, marginBottom: 10, fontFamily: mono }}>
              {index ? `${index}. ` : ""}{parts.keyIdea}
            </div>
          )}
          {parts.body && (
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.8, marginBottom: 12, fontFamily: mono }}>
              {parts.body}
            </div>
          )}
          {renderKeyIdeaAndBody()}
          {parts.example && (
            <div style={{ background: COLORS.bg2, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>From the text</div>
              <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 2.1, fontStyle: "italic", fontFamily: mono }}>
                <AnnotatedQuote text={parts.example} />
              </div>
            </div>
          )}
          {renderExampleTranslation()}
          {parts.breakdown && (() => {
            const raw = parts.breakdown;
            const plainMatch = raw.match(/PLAIN MEANING:\s*(.*?)(?=\s*\|\s*GRAMMAR:|$)/i);
            const gramMatch = raw.match(/GRAMMAR:\s*(.*?)(?=\s*\|\s*FUNCTION:|$)/i);
            const funcMatch = raw.match(/FUNCTION:\s*(.*?)(?=\s*\|\s*USE IT:|$)/i);
            const useMatch = raw.match(/USE IT:\s*(.*)/i);
            const items = [
              { label: "In simple English", text: plainMatch?.[1]?.trim() },
              { label: "Grammar pattern", text: gramMatch?.[1]?.trim() },
            ].filter(i => i.text);
            const funcText = funcMatch?.[1]?.trim();
            const useText = useMatch?.[1]?.trim();
            const grammarName = gramMatch?.[1]?.match(/"([^"]+)"|'([^']+)'/)?.[1] || gramMatch?.[1]?.match(/'([^']+)'/)?.[2] || null;
            return items.length > 0 ? (
              <div style={{ background: "#EDE8E0", borderRadius: 10, padding: "10px 14px", marginTop: 8, marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>Sentence breakdown</div>
                  {grammarName && (
                    <button onClick={() => {
                      const saved = JSON.parse(localStorage.getItem("lyra-saved-concepts") || "[]");
                      const concept = { name: grammarName, grammar: gramMatch?.[1]?.trim(), function: funcText, useIt: useText, example: parts.example, section: section.title, savedAt: Date.now() };
                      if (!saved.some(s => s.name === grammarName)) {
                        saved.push(concept);
                        localStorage.setItem("lyra-saved-concepts", JSON.stringify(saved));
                      }
                      setSavedLabel(grammarName);
                      if (onSave) onSave();
                      setTimeout(() => setSavedLabel(null), 1500);
                    }} style={{ fontSize: 9, fontFamily: mono, padding: "2px 8px", borderRadius: 8, border: `1px solid ${savedLabel === grammarName ? COLORS.accent1 : COLORS.border}`, background: savedLabel === grammarName ? "#F0EDE8" : COLORS.card, color: savedLabel === grammarName ? COLORS.accent1 : COLORS.muted, cursor: "pointer", transition: "all 0.2s" }}>
                      {savedLabel === grammarName ? "Saved!" : "Save"}
                    </button>
                  )}
                </div>
                {items.map((item, k) => (
                  <div key={k} style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6, fontFamily: mono }}>
                    <span style={{ fontWeight: 700, color: COLORS.heading }}>{item.label}: </span>{item.text}
                  </div>
                ))}
                {funcText && (
                  <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6, fontFamily: mono, background: "#E8E3DB", borderRadius: 8, padding: "8px 10px" }}>
                    <span style={{ fontWeight: 700, color: COLORS.heading }}>Why use it: </span>{funcText}
                  </div>
                )}
                {useText && (() => {
                  const m = useText.match(/^([\s\S]+?)\s*(?:→|→|->)\s*([\s\S]+)$/);
                  const template = m ? m[1].trim() : useText;
                  const example = m ? m[2].trim() : "";
                  return (
                    <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, fontFamily: mono, border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 8, padding: "8px 10px" }}>
                      <span style={{ fontWeight: 700, color: COLORS.accent1 }}>Try it yourself: </span>{template}
                      {example && (
                        <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20" }}>
                          <span style={{ fontWeight: 700, color: "#A6701F" }}>For example: </span>{example}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : null;
          })()}
          {renderBreakdownTranslation()}
          {parts.whyItWorks && (
            <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.7, marginTop: 6, fontFamily: mono }}>
              <span style={{ fontWeight: 700 }}>Why it works: </span>{parts.whyItWorks}
            </div>
          )}
          {renderPairs("whyItWorks")}
          {parts.structure && (() => {
            const m = parts.structure.match(/^([\s\S]+?)\s*(?:→|→|->)\s*([\s\S]+)$/);
            const template = m ? m[1].trim() : parts.structure;
            const example = m ? m[2].trim() : "";
            return (
              <div style={{ background: "#F0EDE8", border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 10, padding: "10px 14px", marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>Try this pattern</div>
                <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, fontFamily: mono }}>
                  {template}
                </div>
                {example && (
                  <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20", fontFamily: mono, fontSize: 12, lineHeight: 1.7 }}>
                    <span style={{ fontWeight: 700, color: "#A6701F" }}>For example: </span>{example}
                  </div>
                )}
              </div>
            );
          })()}
          {renderStructureTranslation()}
          {parts.watchOut && (
            <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, marginTop: 10, fontFamily: mono }}>
              <span style={{ fontWeight: 700 }}>WATCH OUT: </span>{parts.watchOut}
            </div>
          )}
          {renderPairs("watchOut")}
          {parts.vocabUpgrade && (
            <div style={{ marginTop: 10, padding: "10px 14px", background: "#F5F0EB", borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.green || "#5a8a5e", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>Writer's words</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {parts.vocabUpgrade.split("|").map((pair, j) => {
                  const trimmed = pair.trim();
                  if (!trimmed) return null;
                  const arrow = trimmed.includes("\u2192") ? "\u2192" : trimmed.includes("->") ? "->" : null;
                  if (!arrow) return <span key={j} style={{ fontSize: 11, color: COLORS.text, fontFamily: mono }}>{trimmed}</span>;
                  const [from, to] = trimmed.split(arrow).map(s => s.trim());
                  return (
                    <span key={j} style={{ fontSize: 11, fontFamily: mono, background: COLORS.card, padding: "3px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: COLORS.muted, textDecoration: "line-through" }}>{from}</span>
                      <span style={{ color: COLORS.accent1 }}>{"\u2192"}</span>
                      <span style={{ color: COLORS.heading, fontWeight: 700 }}>{to}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: mono }}>
            {section.content}
          </div>
          {showTranslation && translation && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${COLORS.border}` }}>
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
                    <div key={i} style={{ marginBottom: 8 }}>
                      {en && <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, fontStyle: "italic" }}>{en}</div>}
                      {zh && <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, marginTop: 2 }}>{zh}</div>}
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function extractAuthor(text) {
  const match = text.match(/^AUTHOR:\s*(.+)$/m);
  return match ? match[1].trim() : "Unknown Author";
}

export function saveStyleSkill(authorName, profileSections) {
  try {
    // All 7 technique sections (sections 1-7 in the styleProfilerPrompt).
    // Previously this list missed WORD CHOICES and FEELING AND PERSONALITY,
    // which caused legitimate analyses (especially opinion columns) to be
    // flagged "too-short" even when 5+ rich sections existed.
    const techSections = [
      "COMPARING AND DESCRIBING",
      "SENTENCE PATTERNS",
      "HOW IDEAS ARE CONNECTED",
      "WORD CHOICES",
      "GRAMMAR TRICKS",
      "HOW THE WRITER PERSUADES",
      "FEELING AND PERSONALITY",
    ];
    const validSections = profileSections.filter(s => techSections.includes(s.title));
    // Lowered threshold from 3 → 2. A two-technique analysis is still useful
    // to save as a skill. Empty/single-section analyses are still rejected.
    if (validSections.length < 2) return null;

    const whenSection = profileSections.find(s => s.title === "WHEN TO USE THIS STYLE");
    const sigSection = profileSections.find(s => s.title === "SIGNATURE STYLE");
    const whenParts = whenSection ? parseSectionContent(whenSection.content) : {};
    const sigParts = sigSection ? parseSectionContent(sigSection.content) : {};

    const rawBullets = whenSection
      ? ((whenSection.content || "").match(/\u2022[^\u2022]+/g) || []).map(b => b.replace(/^\u2022\s*/, "").trim()).filter(b => b && !b.startsWith("KEY IDEA"))
      : [];
    const bullets = [...new Set(rawBullets)].slice(0, 4);

    const analysedTechniques = validSections.map(s => {
      const parts = parseSectionContent(s.content);
      return {
        technique: parts.keyIdea || s.title,
        description: (parts.body || "").slice(0, 250),
        structure: parts.structure || "",
        example: (parts.example || "").replace(/^["\u201C]|["\u201D]$/g, "").slice(0, 200),
      };
    }).filter(t => t.technique);

    const skill = {
      id: "skill_" + Date.now(),
      authorName: authorName || "Unknown Author",
      type: "analysed",
      whenToUse: { keyIdea: whenParts.keyIdea || "", bullets },
      signatureStyle: sigParts.keyIdea || "",
      techniques: analysedTechniques.map(t => t.technique),
      analysedTechniques,
      savedAt: new Date().toISOString(),
    };

    const existing = JSON.parse(localStorage.getItem("lyra-style-skills") || "[]");
    const filtered = existing.filter(s => s.authorName !== skill.authorName);
    filtered.push(skill);
    localStorage.setItem("lyra-style-skills", JSON.stringify(filtered));
    return skill;
  } catch (e) { return null; }
}

// ── XRayView default export ──
// Presentational component displaying X-Ray analysis results.
// No API calls — pure rendering of profileSections.

export default function XRayView({ profileSections, authorName, referenceText, skillSaved, onSave, analyzing, onPractice, trackCall }) {
  const [translation, setTranslation] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    if (!referenceText || translating) return;
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    if (translation) {
      setShowTranslation(true);
      return;
    }
    setTranslating(true);
    try {
      const route = getRouteConfig("translate");
      if (trackCall) trackCall();
      const result = await callAI(translatePrompt, referenceText, false, 4000, route.thinkingBudget, undefined, undefined, route.model);
      setTranslation(result || "");
      setShowTranslation(true);
    } catch (e) {
      setTranslation("翻譯失敗，請再試一次。");
      setShowTranslation(true);
    }
    setTranslating(false);
  };

  if (analyzing) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <div style={{ animation: "featherWrite 1.8s ease-in-out infinite", display: "inline-block", marginBottom: 16 }}>
          <FeatherIcon size={32} />
        </div>
        <div style={{ fontSize: 14, color: COLORS.heading, fontWeight: 700, marginBottom: 6, fontFamily: mono }}>Analysing style...</div>
        <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5, fontFamily: mono }}>
          Searching for the author and building a deep linguistic profile. This may take a moment.
        </div>
      </div>
    );
  }

  if (!profileSections || profileSections.length === 0) return null;

  const sharedCard = { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16 };

  return (
    <div>
      {/* Author card */}
      <div style={{ ...sharedCard, marginBottom: 16, textAlign: "center", padding: 20, background: COLORS.bg2 }}>
        <FeatherIcon size={24} />
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.heading, marginTop: 8, fontFamily: "'Courier Prime', monospace" }}>
          {authorName}
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4, fontFamily: mono }}>Style Profile — {profileSections.length} sections analysed</div>
      </div>

      {skillSaved === "saved" && (
        <div style={{ ...sharedCard, marginBottom: 12, padding: "10px 14px", borderLeft: `3px solid ${COLORS.green}`, background: "#F0F6F1", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>&#10003;</span>
          <div style={{ fontSize: 11, color: COLORS.heading, fontFamily: mono, lineHeight: 1.5 }}>
            <strong>Writing skill saved</strong> — check the Skills tab to review and reuse
          </div>
        </div>
      )}
      {skillSaved === "too-short" && (
        <div style={{ ...sharedCard, marginBottom: 12, padding: "10px 14px", borderLeft: `3px solid ${COLORS.amber}`, background: "#FFF8EE" }}>
          <div style={{ fontSize: 11, color: COLORS.heading, fontFamily: mono, lineHeight: 1.5 }}>
            This passage wasn't detailed enough to generate a reusable writing skill. Try a longer passage (100+ words) with varied sentence structures.
          </div>
        </div>
      )}

      {/* Original text reference */}
      {referenceText && (
        <details style={{ ...sharedCard, marginBottom: 12, padding: 0, cursor: "pointer" }}>
          <summary style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono, listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 8, transition: "transform 0.2s" }}>&#9654;</span> Original text
            </span>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTranslate(); }}
              disabled={translating}
              style={{ fontSize: 10, fontFamily: mono, padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${COLORS.border}`, background: translating ? COLORS.bg2 : COLORS.card, color: COLORS.heading, cursor: translating ? "default" : "pointer", textTransform: "none", letterSpacing: 0, fontWeight: 600 }}
            >
              {translating ? "翻譯中..." : showTranslation ? "隱藏翻譯 · Hide" : "翻譯成中文 · Translate to traditional chinese"}
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
      )}

      {/* Section cards (exclude WHEN TO USE) */}
      {profileSections.filter(s => s.title !== "WHEN TO USE THIS STYLE" && s.title !== "SIGNATURE STYLE").map((section, i) => (
        <SectionCard key={i} index={i + 1} section={section} onSave={onSave} trackCall={trackCall} />
      ))}

      {/* Practice button */}
      {onPractice && (
        <div style={{ textAlign: "center", marginTop: 16, marginBottom: 8 }}>
          <button
            onClick={onPractice}
            style={{ background: `linear-gradient(135deg, ${COLORS.accent1}, ${COLORS.accent2})`, color: "#fff", border: "none", borderRadius: 24, padding: "12px 32px", fontFamily: "'Courier Prime', monospace", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", letterSpacing: 0.5 }}
          >
            Start Practising
          </button>
        </div>
      )}
    </div>
  );
}
