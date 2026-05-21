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

// Trim a description to ~max chars but always end on a complete sentence.
// Prefers a full sentence boundary (. ! ?) before max. Falls back to the last
// word boundary + ellipsis if no sentence punctuation fits. Returns text
// unchanged if it already fits within max. Used by saveStyleSkill so saved
// technique cards never end mid-word (e.g. "...late people a").
export function trimToSentence(text, max) {
  const t = (text || "").trim();
  if (!t || t.length <= max) return t;
  const slice = t.slice(0, max);
  const lastSentence = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (lastSentence > max * 0.5) return t.slice(0, lastSentence + 1);
  const wordCut = slice.replace(/\s+\S*$/, "");
  return (wordCut || slice) + "…";
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
      // Strip the AI's internal "TYPE 1 — FILL-IN-THE-BLANK:" / "TYPE 2 — REWRITE PROMPT:" /
      // "TYPE 3 — HYBRID:" prefix — these are prompt-internal categorisation markers,
      // students don't need to see them on the English source card.
      let structureContent = trimmed.replace("STRUCTURE:", "").trim();
      structureContent = structureContent.replace(/^TYPE\s+\d+\s*[—\-–]\s*[A-Z][A-Z0-9\s\-/()]+\s*[:：.。]\s*/i, "");
      // Strip the inline "Flat: " label (TYPE 2 — REWRITE PROMPT format) — the
      // bare neutral sentence reads fine on its own. Keep Task: and Example: as
      // they're meaningful labels for the student.
      structureContent = structureContent.replace(/\bFlat\s*[:：]\s*/gi, "");
      parts.structure = structureContent;
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
        const isCJK = /[一-龥]/.test(seg.label);
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
              fontSize: isCJK ? 13 : 11,
              fontWeight: 700,
              color: c.text,
              textTransform: isCJK ? "none" : "lowercase",
              letterSpacing: isCJK ? 0 : 0.5,
              fontStyle: "normal",
              fontFamily: mono,
              textAlign: "center",
              whiteSpace: "normal",
              lineHeight: isCJK ? 1.3 : 1.1,
              wordBreak: "keep-all",
              marginBottom: 6,
              transform: "translateY(-3px)",
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
  // PRE-NORMALIZE: LITE often emits subsequent EN:/ZH: markers mid-line (after
  // a period or whitespace) without a newline. Insert a newline before each
  // mid-line marker so the strict `(^|\n)` boundary regex can find them all.
  const normalized = text.replace(
    /([^\n\r])\s*(EN|ZH)\s*[:：]\s*/g,
    (full, prev, marker) => `${prev}\n${marker.toUpperCase()}: `
  );
  const formatAPairs = (() => {
    const re = /(^|\n)\s*(EN|ZH)\s*[:：]\s*/g;
    const markers = [];
    let m;
    while ((m = re.exec(normalized)) !== null) {
      const labelStart = m.index + m[1].length;
      markers.push({ type: m[2].toUpperCase(), labelStart, contentStart: m.index + m[0].length });
    }
    if (markers.length === 0) return [];
    const sections = markers.map((mk, i) => ({
      type: mk.type,
      content: normalized.slice(mk.contentStart, i + 1 < markers.length ? markers[i + 1].labelStart : normalized.length).trim(),
    }));
    const pairs = [];
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].type === "EN") {
        const next = sections[i + 1];
        if (next && next.type === "ZH") {
          pairs.push({ en: sections[i].content, zh: next.content });
          i++;
        } else {
          // Orphan EN with no following ZH — emit pair with empty zh so the
          // completeness guard can detect the LITE model's silent skips.
          pairs.push({ en: sections[i].content, zh: "" });
        }
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
    // STRUCTURE is the source label; "TRY THIS PATTERN" is only the UI label.
    // Flat / Task / Example are TYPE 2/3 sub-pieces that the AI sometimes emits
    // as their own EN/ZH pair without the STRUCTURE parent — route to structure.
    { regex: /^(STRUCTURE|TRY\s+THIS\s+PATTERN|Flat|Task|Example|Pattern)\s*[:：]/i, bucket: "structure" },
    { regex: /^(WRITER['’]?S\s+WORDS|VOCAB\s+UPGRADE)\b/i, bucket: "vocabUpgrade" },
    { regex: /^KEY\s+IDEA\b/i, bucket: "keyIdea" },
    { regex: /^DIFFICULTY\b/i, bucket: "body" },
    { regex: /^WATCH\s+OUT\b/i, bucket: "watchOut" },
    // Structure orphans: TYPE 1 fill-in-the-blank template has multiple `____` runs
    // — the AI often emits this template as its own pair WITHOUT the STRUCTURE parent.
    { regex: /_{3,}[\s\S]*?_{3,}/, bucket: "structure" },
    // Structure orphans: TYPE 1 example pair begins with arrow (the example
    // that follows the template, e.g. `→ "Example sentence here."`).
    { regex: /^["「『]?\s*(?:→|→|->)\s/, bucket: "structure" },
    // WRITER'S WORDS vocab pairs: `plain phrase → "fancy word"`. Require content
    // BEFORE the arrow so structure arrow-examples (which START with `→`) aren't
    // mis-routed here.
    { regex: /^[^→\n_"「『]{2,}\s(?:→|→|->)\s.*["""''「『]/i, bucket: "vocabUpgrade" },
  ];

  // Chinese-side labels — many synonyms because the AI translates the labels
  // differently across runs (文中引述 / 文中節錄 / 文中摘錄 all = "FROM THE TEXT").
  const zhLabelMap = [
    { regex: /^(文中引述|文中例子|文中範例|文中節錄|文中摘錄|原文引述|原文摘錄|原文範例|節錄|摘錄|引文|引述|範例|原文|文中內容|來自文本|摘自內文)/, bucket: "example" },
    { regex: /^(解析|解構|句子解構|句子解析|句子分析|分析|分解|拆解|細部分析|淺白解釋|淺白意義|淺白意涵|簡單來說|簡單意思|簡單解釋|淺顯易懂的解釋|文法|文法模式|文法結構|語法|語法模式|句法|功能|作用|試著使用|試試看|嘗試一下|請試試|練習|活用|運用它|用法|試著運用)/, bucket: "breakdown" },
    { regex: /^(為什麼有效|為何有效|為何重要|此寫法的效果|為什麼這樣寫|效用|寫法的好處)/, bucket: "whyItWorks" },
    { regex: /^(結構|句型結構|寫作結構|句型範本|範本|句式|句型|嘗試這個模式|試試這個模式|試試此模式|套用範本|套用模板|模式|結構拆解|平鋪直敘|平淡說法|任務|範例|例子|模式)/, bucket: "structure" },
    { regex: /^(作者用詞|作者的用語|作者選詞|作家用詞|寫作用詞|寫作詞彙|詞彙升級|用詞升級)/, bucket: "vocabUpgrade" },
    { regex: /^(主要想法|關鍵想法|重點想法|核心概念|核心想法|關鍵概念|主要概念|主旨)/, bucket: "keyIdea" },
    { regex: /^(難度)/, bucket: "body" },
    { regex: /^(注意|小心|警告|常見錯誤|要注意|注意事項)/, bucket: "watchOut" },
    // Structure orphans (Chinese-side mirror of the enLabelMap pattern rules)
    { regex: /_{3,}[\s\S]*?_{3,}/, bucket: "structure" },
    { regex: /^["「『]?\s*(?:→|→|->)\s/, bucket: "structure" },
    // WRITER'S WORDS vocab pairs (Chinese-side mirror)
    { regex: /^[^→\n_"「『]{2,}\s(?:→|→|->)\s.*["」『「''""]/i, bucket: "vocabUpgrade" },
  ];

  const groups = {};
  const fallback = "body";
  // Normalize a pair side for label-routing — strip leading pipe separators
  // (the AI's `| GRAMMAR:` / `| 文法：` row format would otherwise defeat the
  // `^` anchor on every label regex).
  const labelProbe = (s) => (s || "").trim().replace(/^[|｜]\s*/, "");

  for (const pair of pairs) {
    let bucket = null;

    // 1. Check English-side label
    const enProbe = labelProbe(pair.en);
    if (enProbe) {
      for (const { regex, bucket: b } of enLabelMap) {
        if (regex.test(enProbe)) {
          bucket = b;
          break;
        }
      }
    }

    // 2. Check Chinese-side label (when AI translated the label into Chinese)
    const zhProbe = labelProbe(pair.zh);
    if (!bucket && zhProbe) {
      for (const { regex, bucket: b } of zhLabelMap) {
        if (regex.test(zhProbe)) {
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

// ============================================================================
// parseStructureContent — universal parser for the "GIVE IT A GO" / STRUCTURE
// content. Handles all three prompt-defined formats (FILL-IN-THE-BLANK,
// REWRITE PROMPT, HYBRID) in both English and Chinese-translated forms.
//
// Returns one of:
//   { kind: "task-example", intro, task, example }   — TYPE 2/3 (Task/Example)
//   { kind: "template-arrow", template, example }    — TYPE 1 (fill-in + arrow)
//   { kind: "plain", template }                      — neither pattern matched
//   null                                             — no content
// ============================================================================
export function parseStructureContent(text) {
  if (!text || typeof text !== "string") return null;
  // Strip inline labels that don't belong on the student-facing surface.
  const cleaned = text
    .replace(/^TYPE\s+\d+\s*[—\-–]\s*[A-Z][A-Z0-9\s\-/()]+\s*[:：.。]\s*/i, "")
    .replace(/^(?:第\s*[一二三四五六七八九十\d]+\s*類型?|類型?\s*[一二三四五六七八九十\d]+|型\s*[一二三四五六七八九十\d]+)\s*[—\-–]\s*[一-龥A-Za-z0-9\s\-/()「」『』""]+\s*[:：.。]\s*/, "")
    .replace(/\bFlat\s*[:：]\s*/gi, "")
    .replace(/(中性句|平實句|平直句|平淡句|平鋪直敘|普通句|直白句|平句|中立句|平凡句|樸素句)\s*[:：]\s*/g, "")
    .trim();
  if (!cleaned) return null;

  // TYPE 2/3 — Task/Example labels (English or Chinese-translated)
  const taskMatch = cleaned.match(/^([\s\S]+?)\s*(?:Task|任務|任务|作業)\s*[:：]\s*([\s\S]+?)(?:\s*(?:Example|範例|例子|例如)\s*[:：]\s*([\s\S]+))?$/i);
  if (taskMatch) {
    return {
      kind: "task-example",
      intro: taskMatch[1].trim(),
      task: taskMatch[2].trim(),
      example: taskMatch[3] ? taskMatch[3].trim() : "",
    };
  }

  // TYPE 1 — fill-in-the-blank with arrow split
  const arrowMatch = cleaned.match(/^([\s\S]+?)\s*(?:→|→|->)\s*([\s\S]+)$/);
  if (arrowMatch) {
    return {
      kind: "template-arrow",
      template: arrowMatch[1].trim(),
      example: arrowMatch[2].trim(),
    };
  }

  return { kind: "plain", template: cleaned };
}

// ============================================================================
// translateWithGuard — universal completeness-guarded translation helper.
// Used by every translate path so the LITE-tier silent-skip behaviour is
// caught regardless of caller (X-Ray sections, raw reference passages, etc.).
//
// How it works:
//   1. Fires the main translate call.
//   2. Parses the response via parseTranslationPairs.
//   3. Detects two classes of "missing" translations:
//        a) Orphan EN pairs (EN line with no following ZH) — universal,
//           catches sentence-level skips in any unstructured passage.
//        b) Caller-supplied expectedUnits — labelled sub-sections the caller
//           knows should be present (e.g. PLAIN MEANING / GRAMMAR / FUNCTION /
//           USE IT in X-Ray BREAKDOWN content).
//   4. Fires focused parallel re-translate calls for each missing item.
//   5. Validates each focused response (must parse to at least one valid pair)
//      before appending — bare echoed source lines are dropped so they can't
//      corrupt the last legitimate pair's zh content.
// ============================================================================
export async function translateWithGuard(sourceText, route, trackCall, expectedUnits = []) {
  if (trackCall) trackCall();
  let result = await callAI(translatePrompt, sourceText, false, 4000, route.thinkingBudget, undefined, undefined, route.model);
  result = result || "";

  const parsedPairs = parseTranslationPairs(result);

  // (a) Orphan EN pairs — universal sentence-level skip detection.
  const missingLines = [];
  for (const p of parsedPairs) {
    const en = (p.en || "").trim();
    const zh = (p.zh || "").trim();
    if (en && (!zh || zh.length < 2)) missingLines.push(en);
  }

  // (b) Caller-supplied labelled expected units. Strip leading pipe from
  // pair.en before matching so the AI's `| GRAMMAR:` row format doesn't
  // trip a false "missing" alarm.
  for (const unit of expectedUnits) {
    if (!unit || !unit.label || !unit.content || unit.content.length < 3) continue;
    const labelRegex = new RegExp(`^(?:${unit.label.replace(/\s+/g, "\\s+")})\\b`, "i");
    const covered = parsedPairs.some(p =>
      p.zh && p.zh.trim().length > 1 && labelRegex.test((p.en || "").trim().replace(/^[|｜]\s*/, ""))
    );
    if (!covered) missingLines.push(`${unit.label}: ${unit.content}`);
  }

  if (missingLines.length === 0) return result;

  // Fire all missing-line re-calls in parallel — small inputs, LITE handles each cleanly.
  const focused = await Promise.all(missingLines.map(line =>
    callAI(translatePrompt, line, false, 600, route.thinkingBudget, undefined, undefined, route.model)
      .catch(() => "")
  ));
  // SAFE APPEND: only accept a focused-call response if it parses to at
  // least one VALID EN/ZH pair (with non-empty zh). Bare echoed lines would
  // otherwise leak through and corrupt the LAST legitimate pair's zh via
  // parseTranslationPairs' end-of-text capture.
  const validExtras = [];
  for (const f of focused) {
    if (!f || !f.trim()) continue;
    const parsed = parseTranslationPairs(f);
    if (parsed.some(p => p.zh && p.zh.trim().length > 1)) validExtras.push(f.trim());
  }
  if (validExtras.length > 0) result = result.trim() + "\n\n" + validExtras.join("\n\n");
  return result;
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
      // Caller-supplied labelled expected units — derived from `parts` so the
      // helper's missing-section detection knows what to look for. Body
      // paragraphs (parts.body) are intentionally NOT listed because they're
      // unlabelled — orphan-EN detection inside the helper covers any sentence
      // skip in the body content automatically.
      const expectedUnits = [];
      if (parts.keyIdea)      expectedUnits.push({ label: "KEY IDEA",       content: parts.keyIdea });
      if (parts.example)      expectedUnits.push({ label: "FROM THE TEXT",  content: parts.example });
      if (parts.whyItWorks)   expectedUnits.push({ label: "WHY IT WORKS",   content: parts.whyItWorks });
      if (parts.structure)    expectedUnits.push({ label: "STRUCTURE",      content: parts.structure });
      if (parts.vocabUpgrade) expectedUnits.push({ label: "WRITER'S WORDS", content: parts.vocabUpgrade });
      if (parts.watchOut)     expectedUnits.push({ label: "WATCH OUT",      content: parts.watchOut });
      if (parts.breakdown) {
        // Sub-section split — parts.breakdown is `PLAIN MEANING: ... | GRAMMAR: ... | ...`
        const subRe = /(PLAIN\s+MEANING|GRAMMAR|FUNCTION|USE\s+IT)\s*[:：]\s*([\s\S]+?)(?=\s*[|｜]\s*(?:PLAIN\s+MEANING|GRAMMAR|FUNCTION|USE\s+IT)\s*[:：]|$)/gi;
        let sm;
        while ((sm = subRe.exec(parts.breakdown)) !== null) {
          const subContent = sm[2].trim().replace(/[\s|｜]+$/, "");
          if (subContent && subContent.length >= 3) {
            expectedUnits.push({ label: sm[1].trim().replace(/\s+/g, " "), content: subContent });
          }
        }
      }
      const result = await translateWithGuard(section.content, route, trackCall, expectedUnits);
      setTranslation(result);
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
    // Strip Chinese label prefixes AND English source labels AND EN:/ZH: markers AND
    // leading pipe separators (the AI's breakdown format uses `| LABEL:` per line).
    // Loop handles nested prefixes like "解析：FROM THE TEXT：xxx" or "| GRAMMAR: ...".
    for (let i = 0; i < 5; i++) {
      let next = out;
      // 0. Leading pipe separator (the AI's breakdown rows often start with `| `)
      next = next.replace(/^[|｜]\s*/, "");
      // 1. Chinese label prefix (e.g. 解析：/ 為何有效：)
      next = next.replace(/^[一-龥]{1,10}[:：]\s*/, "");
      // 2. English source label prefix that the renderer will re-add (e.g. FROM THE TEXT:/ KEY IDEA:)
      next = next.replace(/^(KEY\s+IDEA|FROM\s+THE\s+TEXT|EXAMPLE|BREAKDOWN|PLAIN\s+MEANING|GRAMMAR|FUNCTION|USE\s+IT|WHY\s+IT\s+WORKS|STRUCTURE|TRY\s+THIS\s+PATTERN|WRITER['’]?S\s+WORDS|VOCAB\s+UPGRADE|WATCH\s+OUT|DIFFICULTY)\s*[:：]\s*/i, "");
      // 3. Stray EN:/ZH: markers leaked from the AI's pair format (§12.9 known bug)
      next = next.replace(/^(EN|ZH)\s*[:：]\s*/i, "");
      // 4. TYPE markers — English (e.g. "TYPE 1 — FILL-IN-THE-BLANK:" or "TYPE 1 — FILL-IN-THE-BLANK.")
      next = next.replace(/^TYPE\s+\d+\s*[—\-–]\s*[A-Z][A-Z0-9\s\-/()]+\s*[:：.。]\s*/i, "");
      // 5. TYPE markers — Chinese translation. Covers all common forms:
      //    "類型 1 — 填空題：" / "類型一 — 填空題：" / "型 1 — 填空題：" / "第一類型 — 填空題：" / "第1類型 — 填空題："
      next = next.replace(/^(?:第\s*[一二三四五六七八九十\d]+\s*類型?|類型?\s*[一二三四五六七八九十\d]+|型\s*[一二三四五六七八九十\d]+)\s*[—\-–]\s*[一-龥A-Za-z0-9\s\-/()「」『』""]+\s*[:：.。]\s*/, "");
      if (next === out) break;
      out = next;
    }
    return out.trim();
  };
  // Map bucket key → label prefix shown before the Chinese content. CJK prefixes
  // use full-width colons automatically (handled by the renderer below).
  const bucketLabels = {
    keyIdea: "KEY IDEA",
    whyItWorks: "寫法的好處",
    vocabUpgrade: "WRITER'S WORDS",
    watchOut: "注意事項",
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
            {labelPrefix && i === 0 ? <span style={{ fontWeight: 700 }}>{labelPrefix}{/[一-龥]/.test(labelPrefix) ? "：" : ": "}</span> : null}
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
    // Unified style — matches the English body paragraph styling (size 12,
    // regular weight, COLORS.text). KEY IDEA translation reads as part of the
    // same Chinese paragraph rather than its own bold heading.
    const lineStyle = {
      fontSize: 12,
      fontWeight: 400,
      color: COLORS.text,
      lineHeight: 1.8,
      marginBottom: 4,
      fontFamily: mono,
    };
    return (
      <div style={{ marginTop: 8, marginBottom: 12, paddingTop: 6 }}>
        {keyIdeaLines.map((zh, i) => (
          <div key={`k${i}`} style={lineStyle}>
            {index ? `${index}. ` : ""}{zh}
          </div>
        ))}
        {bodyLines.map((zh, i) => (
          <div key={`b${i}`} style={lineStyle}>
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
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, marginBottom: 8, letterSpacing: 1 }}>
          譯文
        </div>
        {zhLines.map((zh, i) => (
          <div key={i} style={{ fontSize: 12, color: COLORS.heading, lineHeight: 4.5, fontStyle: "italic", marginBottom: 4 }}>
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
    const parsed = parseStructureContent(joined);
    if (!parsed) return null;
    return (
      <div style={{ background: "#F0EDE8", border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 10, padding: "10px 14px", marginTop: 8, marginBottom: 12, fontFamily: mono }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, marginBottom: 6, letterSpacing: 1 }}>試試看</div>
        {parsed.kind === "task-example" ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.heading, lineHeight: 1.7, marginBottom: 8 }}>
              {parsed.intro}
            </div>
            <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, marginBottom: parsed.example ? 8 : 0 }}>
              <span style={{ fontWeight: 700 }}>任務：</span>{parsed.task}
            </div>
            {parsed.example && (
              <div style={{ background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20", fontSize: 12, lineHeight: 1.7 }}>
                <span style={{ fontWeight: 700, color: "#A6701F" }}>範例：</span>{parsed.example}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7 }}>
              {parsed.template}
            </div>
            {parsed.kind === "template-arrow" && parsed.example && (
              <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20", fontSize: 12, lineHeight: 1.7 }}>
                <span style={{ fontWeight: 700, color: "#A6701F" }}>範例：</span>{parsed.example}
              </div>
            )}
          </>
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
    // Pass each zh through stripRedundantPrefix so the AI-emitted "文法：" / "GRAMMAR:"
    // prefix doesn't end up doubled with the renderer's own "文法：" prefix.
    // Strip leading `|` from pair.en before label-matching — the AI's
    // `| GRAMMAR:` row format would otherwise defeat the `^` anchor.
    let plainFromPair = "", gramFromPair = "", funcFromPair = "", useItFromPair = "";
    for (const p of pairs) {
      const en = (p.en || "").trim().replace(/^[|｜]\s*/, "");
      const zh = stripRedundantPrefix((p.zh || "").trim());
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
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, marginBottom: 8, letterSpacing: 1 }}>句子解析</div>
          {plain && (
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: COLORS.heading }}>淺白解釋：</span>{plain}
            </div>
          )}
          {gram && (
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: COLORS.heading }}>文法：</span>{gram}
            </div>
          )}
          {func && (
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6, background: "#E8E3DB", borderRadius: 8, padding: "8px 10px" }}>
              <span style={{ fontWeight: 700, color: COLORS.heading }}>功能：</span>{func}
            </div>
          )}
          {useIt && (() => {
            const m = useIt.match(/^([\s\S]+?)\s*(?:→|→|->)\s*([\s\S]+)$/);
            const template = stripRedundantPrefix(m ? m[1].trim() : useIt);
            const example = stripRedundantPrefix(m ? m[2].trim() : "");
            return (
              <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 8, padding: "8px 10px" }}>
                <span style={{ fontWeight: 700, color: COLORS.accent1 }}>試著使用：</span>{template}
                {example && (
                  <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20", fontSize: 12, lineHeight: 1.7 }}>
                    <span style={{ fontWeight: 700, color: "#A6701F" }}>例如：</span>{example}
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

    // Label dictionaries — the AI uses many synonyms across sessions, including the
    // English source labels (when it preserves them in the Chinese translation).
    const plainLabels  = ["淺白解釋", "淺白意義", "淺白含義", "白話解釋", "白話翻譯", "白話意義",
                          "簡單來說", "簡單英文", "簡單英語", "簡單意思", "簡單含義", "簡明意思",
                          "基本意思", "基本含義", "主要意思", "直白意思", "字面意思", "字面含義",
                          "用簡單的話", "用簡單英文", "用淺白的話", "白話地說", "用平實的話",
                          "明白意思", "易懂的意思", "簡單版本", "PLAIN\\s+MEANING"];
    const gramLabels   = ["文法", "語法", "文法模式", "語法模式", "文法結構", "語法結構", "句法",
                          "文法用法", "文法現象", "句子結構", "語法用法", "GRAMMAR"];
    const funcLabels   = ["功能", "作用", "目的", "用途", "效用", "效果", "FUNCTION"];
    const useLabels    = ["試著使用", "試試看", "試試", "嘗試一下", "請試試", "練習", "自己試試",
                          "動手試試", "試著套用", "嘗試套用", "套用練習", "來試試", "套用模板",
                          "套用方法", "你也試試", "你來試試", "USE\\s+IT"];
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
    // Splits on ANY Chinese-character label (1-12 chars before a colon) OR English
    // source labels, so the AI can use whatever terms it likes — we route by ORDER.
    if (!plain || !gram || !func || !useIt) {
      const segments = [];
      const segRe = /((?:[一-龥]{1,12})|(?:PLAIN\s+MEANING|GRAMMAR|FUNCTION|USE\s+IT))\s*[:：]\s*([\s\S]+?)(?=[\s|｜]*(?:[一-龥]{1,12}|(?:PLAIN\s+MEANING|GRAMMAR|FUNCTION|USE\s+IT))\s*[:：]|$)/gi;
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

    // If the AI omitted a PLAIN MEANING label but emitted content BEFORE the first
    // matched label, treat that leading content as the plain meaning.
    if (!plain) {
      const firstLabel = body.match(/(?:[一-龥]{1,12}|(?:PLAIN\s+MEANING|GRAMMAR|FUNCTION|USE\s+IT))\s*[:：]/i);
      if (firstLabel && firstLabel.index > 0) {
        const leading = body.slice(0, firstLabel.index).trim().replace(/[\s|｜]+$/, "");
        if (leading.length > 1) plain = leading;
      }
    }

    if (!plain && !gram && !func && !useIt) {
      // Couldn't structurally parse — render raw lines in a card so visuals match
      // the other styled breakdown paths.
      const rawPairs = renderPairs("breakdown");
      if (!rawPairs) return null;
      return (
        <div style={{ background: "#EDE8E0", borderRadius: 10, padding: "10px 14px", marginTop: 8, marginBottom: 12, fontFamily: mono }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, marginBottom: 8, letterSpacing: 1 }}>句子解析</div>
          {rawPairs}
        </div>
      );
    }

    // Strip any nested label prefix (e.g. "文法：文法：xxx" / "GRAMMAR: 文法：xxx")
    // so the renderer's own prefix doesn't end up doubled.
    plain = stripRedundantPrefix(plain || "");
    gram  = stripRedundantPrefix(gram || "");
    func  = stripRedundantPrefix(func || "");
    useIt = stripRedundantPrefix(useIt || "");

    return (
      <div style={{ background: "#EDE8E0", borderRadius: 10, padding: "10px 14px", marginTop: 8, marginBottom: 12, fontFamily: mono }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, marginBottom: 8, letterSpacing: 1 }}>句子解析</div>
        {plain && (
          <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: COLORS.heading }}>淺白解釋：</span>{plain}
          </div>
        )}
        {gram && (
          <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: COLORS.heading }}>文法：</span>{gram}
          </div>
        )}
        {func && (
          <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, marginBottom: 6, background: "#E8E3DB", borderRadius: 8, padding: "8px 10px" }}>
            <span style={{ fontWeight: 700, color: COLORS.heading }}>功能：</span>{func}
          </div>
        )}
        {useIt && (() => {
          const m = useIt.match(/^([\s\S]+?)\s*(?:→|→|->)\s*([\s\S]+)$/);
          const template = stripRedundantPrefix(m ? m[1].trim() : useIt);
          const example = stripRedundantPrefix(m ? m[2].trim() : "");
          return (
            <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 8, padding: "8px 10px" }}>
              <span style={{ fontWeight: 700, color: COLORS.accent1 }}>試著使用：</span>{template}
              {example && (
                <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20", fontSize: 12, lineHeight: 1.7 }}>
                  <span style={{ fontWeight: 700, color: "#A6701F" }}>例如：</span>{example}
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
              <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 4.5, fontStyle: "italic", fontFamily: mono }}>
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
            const parsed = parseStructureContent(parts.structure);
            if (!parsed) return null;
            return (
              <div style={{ background: "#F0EDE8", border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 10, padding: "10px 14px", marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>Give it a go</div>
                {parsed.kind === "task-example" ? (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.heading, lineHeight: 1.7, fontFamily: mono, marginBottom: 8 }}>
                      {parsed.intro}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, fontFamily: mono, marginBottom: parsed.example ? 8 : 0 }}>
                      <span style={{ fontWeight: 700 }}>Task: </span>{parsed.task}
                    </div>
                    {parsed.example && (
                      <div style={{ background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20", fontFamily: mono, fontSize: 12, lineHeight: 1.7 }}>
                        <span style={{ fontWeight: 700, color: "#A6701F" }}>Example: </span>{parsed.example}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, fontFamily: mono }}>
                      {parsed.template}
                    </div>
                    {parsed.kind === "template-arrow" && parsed.example && (
                      <div style={{ marginTop: 8, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 6, padding: "6px 10px", color: "#6B4A20", fontFamily: mono, fontSize: 12, lineHeight: 1.7 }}>
                        <span style={{ fontWeight: 700, color: "#A6701F" }}>For example: </span>{parsed.example}
                      </div>
                    )}
                  </>
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
        description: trimToSentence(parts.body || "", 350),
        structure: parts.structure || "",
        example: trimToSentence((parts.example || "").replace(/^["\u201C]|["\u201D]$/g, ""), 250),
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
      // Full sections (raw title + content) so the saved skill can be re-rendered
      // via SectionCard later — gives the same rich X-Ray-style detail view as the
      // post-analysis page.
      sections: validSections.map(s => ({ title: s.title, content: s.content })),
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
      // Raw passage — no labelled units to enumerate; the helper's orphan-EN
      // detection alone catches LITE's sentence-level skips.
      const result = await translateWithGuard(referenceText, route, trackCall);
      setTranslation(result);
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
