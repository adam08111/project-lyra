import { useState } from "react";
import { COLORS } from "../constants.js";
import { FeatherIcon } from "./Icons.jsx";

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
  const parts = { keyIdea: "", body: "", example: "", breakdown: "", whyItWorks: "", structure: "", vocabUpgrade: "" };
  const lines = content.split("\n");
  let current = "body";

  for (const line of lines) {
    const trimmed = line.trim();
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
    } else if (trimmed.startsWith("WRITER'S WORDS:") || trimmed.startsWith("WRITER\u2019S WORDS:") || trimmed.startsWith("VOCAB UPGRADE:")) {
      parts.vocabUpgrade = trimmed.replace(/(?:WRITER[''\u2019]S WORDS|VOCAB UPGRADE):/, "").trim();
      current = "vocab";
    } else if (trimmed) {
      if (current === "body") parts.body += (parts.body ? "\n" : "") + trimmed;
      else if (current === "example") parts.example += " " + trimmed;
      else if (current === "breakdown") parts.breakdown += " " + trimmed;
      else if (current === "why") parts.whyItWorks += " " + trimmed;
      else if (current === "structure") parts.structure += " " + trimmed;
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

export function SectionCard({ section, onSave }) {
  const parts = parseSectionContent(section.content);
  const hasStructure = parts.keyIdea || parts.example;
  const [savedLabel, setSavedLabel] = useState(null);

  return (
    <div style={{ background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, borderRight: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.accent1}`, borderRadius: 14, marginBottom: 12, padding: 16, fontFamily: mono }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent1, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: mono }}>
        {section.title}
      </div>

      {hasStructure ? (
        <>
          {parts.keyIdea && (
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, lineHeight: 1.6, marginBottom: 10, fontFamily: mono }}>
              {parts.keyIdea}
            </div>
          )}
          {parts.body && (
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.8, marginBottom: 12, fontFamily: mono }}>
              {parts.body}
            </div>
          )}
          {parts.example && (
            <div style={{ background: COLORS.bg2, borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>From the text</div>
              <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 2.1, fontStyle: "italic", fontFamily: mono }}>
                <AnnotatedQuote text={parts.example} />
              </div>
            </div>
          )}
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
                {useText && (
                  <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, fontFamily: mono, border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 8, padding: "8px 10px" }}>
                    <span style={{ fontWeight: 700, color: COLORS.accent1 }}>Try it yourself: </span>{useText}
                  </div>
                )}
              </div>
            ) : null;
          })()}
          {parts.whyItWorks && (
            <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.7, marginTop: 6, fontFamily: mono }}>
              <span style={{ fontWeight: 700 }}>Why it works: </span>{parts.whyItWorks}
            </div>
          )}
          {parts.structure && (
            <div style={{ background: "#F0EDE8", border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 10, padding: "10px 14px", marginTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>Try this pattern</div>
              <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.7, fontFamily: mono }}>
                {parts.structure}
              </div>
            </div>
          )}
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
        <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: mono }}>
          {section.content}
        </div>
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
    const techSections = ["COMPARING AND DESCRIBING", "SENTENCE PATTERNS", "HOW IDEAS ARE CONNECTED", "GRAMMAR TRICKS", "HOW THE WRITER PERSUADES"];
    const validSections = profileSections.filter(s => techSections.includes(s.title));
    if (validSections.length < 3) return null;

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

export default function XRayView({ profileSections, authorName, referenceText, skillSaved, onSave, analyzing, onPractice }) {
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
          <summary style={{ padding: "10px 14px", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono, listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 8, transition: "transform 0.2s" }}>&#9654;</span> Original text
          </summary>
          <div style={{ padding: "0 14px 12px", fontSize: 12, color: COLORS.text, lineHeight: 1.8, fontFamily: mono, fontStyle: "italic", borderTop: `1px solid ${COLORS.border}`, marginTop: 0, paddingTop: 10 }}>
            {referenceText}
          </div>
        </details>
      )}

      {/* Section cards (exclude WHEN TO USE) */}
      {profileSections.filter(s => s.title !== "WHEN TO USE THIS STYLE").map((section, i) => (
        <SectionCard key={i} section={section} onSave={onSave} />
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
