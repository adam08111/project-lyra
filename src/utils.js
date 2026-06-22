// Shared utilities for parsing AI technique responses

// === ANTI-BIAS: Author Identity Isolation ===
// Students see real author names; the AI only ever sees "Writer A", "Writer B", etc.
// This prevents the AI's training data from contaminating coaching.

/**
 * Strips author identity from skills before sending to AI.
 * Returns anonymised copies — never mutates originals.
 *
 * @param {Array} skills - Array of skill objects with authorName
 * @returns {{ anonymised: Array, mapping: Array<{writerLabel: string, realName: string}> }}
 */
export function anonymiseSkillsForAI(skills) {
  const mapping = [];
  const anonymised = skills.map((skill, index) => {
    const writerLabel = `Writer ${String.fromCharCode(65 + (index % 26))}`;
    const originalAuthor = skill.authorName || '';
    mapping.push({ writerLabel, realName: originalAuthor });

    // Deep copy to avoid mutating the original
    const anon = JSON.parse(JSON.stringify(skill));

    // Replace author name in all text fields
    const replaceAuthor = (text) => {
      if (!text || !originalAuthor) return text;
      const patterns = [
        originalAuthor,
        originalAuthor.split(' ').pop(),  // Last name only ("Orwell")
        originalAuthor.split(' ')[0],     // First name only ("George")
      ].filter(p => p.length > 2);

      let result = text;
      patterns.forEach(pattern => {
        // Escape regex metacharacters — author names can contain "()", ".", etc.
        // (e.g. "Alaina Demopoulos (The Guardian)"), which would otherwise build
        // an invalid RegExp and throw "Invalid regular expression".
        const safe = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(new RegExp(safe, 'gi'), writerLabel);
      });
      return result;
    };

    // Anonymise all fields that might contain author identity
    anon.authorName = writerLabel;
    if (anon.author_name) anon.author_name = writerLabel;
    anon.signatureStyle = replaceAuthor(anon.signatureStyle);
    anon.signature_style = replaceAuthor(anon.signature_style);

    if (anon.techniques) {
      anon.techniques = anon.techniques.map(t =>
        typeof t === 'string' ? replaceAuthor(t) : {
          ...t,
          technique: replaceAuthor(t.technique),
          description: replaceAuthor(t.description),
          example: replaceAuthor(t.example),
        }
      );
    }
    if (anon.analysedTechniques) {
      anon.analysedTechniques = anon.analysedTechniques.map(t => ({
        ...t,
        technique: replaceAuthor(t.technique),
        description: replaceAuthor(t.description),
        example: replaceAuthor(t.example),
      }));
    }
    if (anon.researchedTechniques) {
      anon.researchedTechniques = anon.researchedTechniques.map(t => ({
        ...t,
        technique: replaceAuthor(t.technique),
        description: replaceAuthor(t.description),
        example: replaceAuthor(t.example),
      }));
    }
    if (anon.when_to_use) {
      anon.when_to_use = anon.when_to_use.map(replaceAuthor);
    }
    if (anon.when_not_to_use) {
      anon.when_not_to_use = anon.when_not_to_use.map(replaceAuthor);
    }
    // The newer `sections` field (raw title + content per technique, added
    // 17 May / §15.2) can carry the author's name in its prose. Scrub it too,
    // or the real name leaks to the AI through the saved skill. (§10)
    if (anon.sections) {
      anon.sections = anon.sections.map(s => ({
        ...s,
        title: replaceAuthor(s.title),
        content: replaceAuthor(s.content),
      }));
    }

    return anon;
  });

  return { anonymised, mapping };
}

/**
 * Restores anonymous Writer labels back to real author names for display.
 *
 * @param {string} text - AI response text containing "Writer A", "Writer B" etc.
 * @param {Array<{writerLabel: string, realName: string}>} mapping - The mapping from anonymiseSkillsForAI
 * @returns {string} - Text with real author names restored
 */
export function restoreAuthorNames(text, mapping) {
  if (!text || !mapping?.length) return text;
  let result = text;
  mapping.forEach(({ writerLabel, realName }) => {
    if (realName) {
      result = result.replace(new RegExp(writerLabel, 'g'), realName);
    }
  });
  return result;
}

/**
 * Anti-bias prompt block to prepend to any AI prompt that receives skill context.
 */
export const ANTI_BIAS_BLOCK = `
ANTI-BIAS RULES — CRITICAL:

You are coaching based on techniques the student personally extracted
from published texts through Style Lab analysis. Each skill is labelled
with an anonymous Writer ID (Writer A, Writer B, etc.).

1. Do NOT attempt to identify any writer by their real name.
2. Do NOT use any knowledge about any author from your training data.
3. Coach ONLY using the technique descriptions, examples, and student
   practice attempts provided in the skill cards.
4. If a skill card does not mention a concept, you do not know it.
5. Do NOT say "this author is known for..." or "this writer typically..."
6. Do NOT reference any work, book, essay, or speech not quoted in the
   skill card.
7. If the student asks "who is Writer A?", respond: "Writer A is the
   author you analysed in Style Lab. I coach based on the techniques
   you extracted, not on background information about the writer."
8. When comparing techniques across writers, compare ONLY the technique
   descriptions. Never compare based on author identity or reputation.

Any knowledge not explicitly present in the skill cards provided below
DOES NOT EXIST for the purposes of this conversation.
`;

// Strip markdown formatting from text
export const stripMd = (t) => t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/\*\s*/g, "").replace(/^\s*[-\u2013\u2022]\s*/, "").trim();

// Robustly parse a single JSON object from a model response that may wrap it in
// ```json fences, prepend preamble/prose, or trail commentary. Strips fences,
// then slices the outermost { ... } before parsing (the growth-report
// parseProfileJSON pattern). Throws if there is no complete, valid object \u2014
// e.g. the model returned prose with no braces, or truncated/unterminated JSON
// (both observed on the Lite tier) \u2014 so the caller can retry / show an error
// rather than rendering nothing.
export function extractJsonObject(text) {
  let t = (text || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

// §59 — group proofread grammar issues into ONE entry per underlying RULE
// (patterns over instances), ranked most-frequent-first. Accepts the grouped
// shape (entry.instances:[{wrong,right}]) OR the legacy flat shape
// (entry.phrase/correction) and merges flat entries that share a rule — so the
// UI always shows one card per rule no matter which shape the model returns.
// Each group: { rule, explanation, instances:[{wrong,right}], example_wrong, example_correct }.
export function groupGrammarByRule(grammar) {
  if (!Array.isArray(grammar)) return [];
  const byRule = new Map();
  for (const g of grammar) {
    if (!g) continue;
    const rule = (g.rule || "General").toString().trim() || "General";
    const key = rule.toLowerCase();
    if (!byRule.has(key)) {
      byRule.set(key, { rule, explanation: "", instances: [], example_wrong: "", example_correct: "" });
    }
    const grp = byRule.get(key);
    if (!grp.explanation && g.explanation) grp.explanation = g.explanation;
    if (!grp.example_wrong && g.example_wrong) grp.example_wrong = g.example_wrong;
    if (!grp.example_correct && g.example_correct) grp.example_correct = g.example_correct;
    const raw = (Array.isArray(g.instances) && g.instances.length)
      ? g.instances
      : [{ wrong: g.phrase ?? g.wrong, right: g.correction ?? g.right }];
    for (const it of raw) {
      const wrong = (it && (it.wrong ?? it.phrase)) || "";
      const right = (it && (it.right ?? it.correction)) || "";
      if (wrong || right) grp.instances.push({ wrong, right });
    }
  }
  // Drop any group that ended up with no real instance — a Lite-tier reply that
  // emits a rule header but truncates/omits its wrong→right pairs (common near
  // the token ceiling) would otherwise render a hollow "0 places" card, suppress
  // the "no issues" placeholder, and persist a blank junk row to the Grammar Log.
  return [...byRule.values()]
    .filter(g => g.instances.length)
    .sort((a, b) => b.instances.length - a.instances.length);
}

// Truncate at word boundary with ellipsis
export const truncate = (t, max) => { if (t.length <= max) return t; const cut = t.slice(0, max).replace(/\s+\S*$/, ""); return (cut || t.slice(0, max)) + "\u2026"; };

// Parse AI response into writing technique objects
// Extracts: technique, description, example, source, url, and optionally paragraphRole
export function parseTechniques(result) {
  const text = typeof result === "string" ? result : result.text;
  if (!text || text.length < 50) return null;

  // Split into numbered sections: "### 1." or "1." or "## 1." patterns
  const sections = text.split(/(?=(?:^|\n)(?:#{1,3}\s*)?\d+[\.\)]\s)/);
  const techniques = [];

  for (const section of sections) {
    if (!section.trim() || section.trim().length < 30) continue;

    // === TECHNIQUE NAME ===
    let technique = "";

    // Strategy 1: heading line "### N. Name"
    const headingMatch = section.match(/(?:^|\n)\s*#{1,3}\s*\d+[\.\)]\s+(.+)/);
    if (headingMatch) {
      technique = stripMd(headingMatch[1]).replace(/^["':]+|["':]+$/g, "").trim().slice(0, 60);
    }

    // Strategy 2: "**Technique name:** Name"
    if (!technique) {
      const techLabel = section.match(/\*\*Technique(?:\s*name)?\*\*[\s:]+([^\n*]+)/i)
        || section.match(/\*\*Technique(?:\s*name)?[\s:]+([^*]+)\*\*/i);
      if (techLabel) technique = stripMd(techLabel[1]).replace(/^["']|["']$/g, "").slice(0, 60);
    }

    // Strategy 3: "N. **Bold Name**"
    if (!technique) {
      const numberedBold = section.match(/(?:^|\n)\s*\d+[\.\)]\s+\*\*([^*]+)\*\*/);
      if (numberedBold) technique = numberedBold[1].replace(/[\s:]*$/, "").trim().slice(0, 60);
    }

    // Strategy 4: "N. Plain Name"
    if (!technique) {
      const numberedPlain = section.match(/(?:^|\n)\s*\d+[\.\)]\s+([^\n*#]+)/);
      if (numberedPlain) {
        const t = stripMd(numberedPlain[1]).replace(/^["':]+|["':]+$/g, "").trim();
        if (t.length > 3) technique = t.slice(0, 60);
      }
    }

    if (!technique || technique.length < 3) continue;
    // Skip field-label artifacts (e.g. "What to do", "Example", "Source")
    if (/^(what to do|example|source|paragraph role|technique name)/i.test(technique)) continue;

    // === DESCRIPTION (What to do) ===
    const descMatch = section.match(/\*\*What to do:?\*\*[\s:]*([^\n]+(?:\n(?!\s*[\*#\d])(?!\s*$)[^\n]+)*)/i)
      || section.match(/\*\*Description:?\*\*[\s:]*([^\n]+)/i);
    let description = descMatch ? truncate(stripMd(descMatch[1]), 350) : "";
    if (!description) {
      const lines = section.split("\n").map(l => stripMd(l)).filter(l =>
        l.length > 25 && l !== technique && !/^(what to do|example|source|paragraph role|#|\d)/i.test(l)
      );
      description = truncate(lines[0] || "", 350);
    }

    // === EXAMPLE ===
    // Cross-line lazy match — stops at the next labeled field (Source, Technique, etc.) or end of section
    const exMatch = section.match(/\*\*Example:?\*\*[\s:]*([\s\S]*?)(?=\n\s*\*\*(?:Source|What to do|Description|Technique(?:\s*name)?|Paragraph role):?\*\*|\n\s*\[[\w].*\]\(https?:\/\/|$)/i);
    let example = exMatch ? truncate(stripMd(exMatch[1].trim()).replace(/^[\"'\u201c\u201d]|[\"'\u201c\u201d]$/g, ""), 500) : "";
    if (!example) {
      // Fallback: Before/After pattern anywhere in the section
      const baMatch = section.match(/Before:\s*([^\n]+)[\s\S]*?After:\s*([^\n]+)/i);
      if (baMatch) example = truncate("Before: " + stripMd(baMatch[1].trim()) + "\nAfter: " + stripMd(baMatch[2].trim()), 500);
    }
    if (!example) {
      const quoteMatch = section.match(/[\"\u201c]([^\"\u201d]{20,})[\"\u201d]/);
      if (quoteMatch) example = truncate(quoteMatch[1].trim(), 280);
    }

    // === SOURCE URL ===
    const linkMatch = section.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    let url = linkMatch ? linkMatch[2] : "";
    let source = "";
    if (url) { try { source = new URL(url).hostname.replace("www.", ""); } catch {} }

    // === PARAGRAPH ROLE (optional — present in enrichment responses) ===
    const roleMatch = section.match(/\*\*Paragraph role:?\*\*[\s:\u2014-]*([^\n]+)/i)
      || section.match(/Paragraph role[\s:\u2014-]+([^\n*]+)/i);
    const paragraphRole = roleMatch ? roleMatch[1].trim().toLowerCase().replace(/[^a-z]/g, "") : null;

    techniques.push({ technique, description, example, source, url, paragraphRole });
  }

  return techniques.length >= 1 ? techniques.slice(0, 5) : null;
}

/**
 * Compact source pills for grounded chat replies: [{label, url}], capped at 4,
 * deduped by label, malformed entries skipped. Gemini grounding chunks carry
 * the real domain in `title` ("scmp.com") while `uri` is a Google redirect
 * (vertexaisearch…), so a hostname-looking title wins over the uri's hostname.
 */
export function formatSources(sources) {
  const out = [];
  const seen = new Set();
  const hostFromUrl = (u) => {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  };
  for (const s of Array.isArray(sources) ? sources : []) {
    if (!s) continue;
    const url = s.uri || s.url || "";
    const title = (s.title || "").trim();
    const label = (/^[\w-]+(\.[\w-]+)+$/.test(title) ? title.replace(/^www\./, "") : "") || hostFromUrl(url);
    if (!label || !url) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, url });
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * Append a local "Switched to …" notice — but if the LAST message is already
 * a switch notice, REPLACE it instead (toying with the type picker used to
 * stack four notices in a row). Pure: returns a new array.
 */
export function upsertSwitchNotice(messages, text) {
  const msgs = Array.isArray(messages) ? messages : [];
  const last = msgs[msgs.length - 1];
  if (last && last.role === "ai" && /^Switched to .+\. I'll coach for that now/.test(last.text || "")) {
    return [...msgs.slice(0, -1), { role: "ai", text }];
  }
  return [...msgs, { role: "ai", text }];
}
