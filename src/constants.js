export const COLORS = {
  bg1: "#F7F5F2", bg2: "#F4F1EE", bg3: "#EDE9E5",
  card: "#fff", border: "#E2E5EA",
  text: "#2A2520", muted: "#7A7470", heading: "#3A3530",
  accent1: "#9E9A96", accent2: "#B8B4AF",
  green: "#6B9E78", red: "#D94F4F", amber: "#C47C0A", blue: "#3A8FBF",
  logoBg1: "#E8E4E0", logoBg2: "#F0EDEA",
};

export const FONTS_LINK = "https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Special+Elite&display=swap";

export const writingTypes = [
  { id: "complaint", label: "Complaint Letter", icon: "envelope" },
  { id: "email", label: "Formal Business Email", icon: "briefcase" },
  { id: "essay", label: "Exam Essay", icon: "document" },
  { id: "story", label: "Story / Narrative", icon: "book" },
  { id: "report", label: "Report", icon: "report" },
  { id: "persuasive", label: "Persuasive Writing", icon: "speech" },
];

// Task-matched default X-Ray section sets. The student no longer picks a section
// count; Lyra analyses 2-3 sections chosen to fit the writing type, and the rest
// arrive later via "Analyse more of this writer". Names must match prompts.js
// XRAY_ALL_SECTIONS exactly. WHEN TO USE THIS STYLE / SIGNATURE STYLE are NEVER in
// a default set — they only arrive via "Analyse more".
export const XRAY_SECTION_DEFAULTS = {
  essay:      ["HOW THE WRITER PERSUADES", "SENTENCE PATTERNS", "WORD CHOICES"],
  persuasive: ["HOW THE WRITER PERSUADES", "FEELING AND PERSONALITY", "SENTENCE PATTERNS"],
  story:      ["COMPARING AND DESCRIBING", "FEELING AND PERSONALITY", "SENTENCE PATTERNS"],
  complaint:  ["WORD CHOICES", "HOW IDEAS ARE CONNECTED", "FEELING AND PERSONALITY"],
  email:      ["WORD CHOICES", "HOW IDEAS ARE CONNECTED", "FEELING AND PERSONALITY"],
  report:     ["HOW IDEAS ARE CONNECTED", "WORD CHOICES", "SENTENCE PATTERNS"],
  _default:   ["SENTENCE PATTERNS", "WORD CHOICES", "COMPARING AND DESCRIBING"],
};

// The default section set for a writing-type id (e.g. "essay"), or the generic
// _default set when the type is unknown/absent (e.g. the Source step, where the
// writing type isn't chosen yet).
export function defaultXraySections(typeId) {
  return XRAY_SECTION_DEFAULTS[typeId] || XRAY_SECTION_DEFAULTS._default;
}

// Canned quick-action chip messages. Single source of truth: ChatTab builds
// its chips from the ACTIVE entries (first three; [0] is a static prefix the
// chip appends a type tail to), and learning-sync rejects any "growth" entry
// whose `before` is ANY entry here — chips are sent AS user messages, so
// provenance alone would wrongly authenticate them as student writing.
// RETIRED entries stay registered forever: old sessions still contain them
// and the validator must keep rejecting them.
export const QUICK_ACTION_MESSAGES = [
  // — active — ("Search the web" is load-bearing: without the explicit phrase
  // the model skips executing the grounding tool and answers from memory)
  "Please outline the full structure for my",
  "Search the web and help me brainstorm angles for this topic — ground them in real, recent examples I could build on.",
  "Search the web and find me a real example I could use to develop the point I'm working on.",
  // — retired (validator-only) —
  "Help me brainstorm the main points and arguments for my writing.",
  "Search the web for relevant facts, statistics, or examples I could use in my",
  "Help me brainstorm angles for this topic — ground them in real, recent examples I could build on.",
  "Find me a real example I could use to develop the point I'm working on.",
];

export const wordCounts = [50, 100, 150, 200, 300, 400, 500, "600+"];

// ── NEW: Writing purpose / exam context ──
export const writingPurposes = [
  { id: "hkdse", label: "HKDSE", description: "Hong Kong DSE English Paper 2" },
  { id: "ielts_task2", label: "IELTS Task 2", description: "IELTS Academic Writing Task 2" },
  { id: "toefl", label: "TOEFL", description: "TOEFL Independent Writing" },
  { id: "cambridge", label: "Cambridge", description: "Cambridge CAE / CPE Writing" },
  { id: "school", label: "School", description: "School assignment or homework" },
  { id: "personal", label: "Personal", description: "Personal or creative project" },
];

// ── NEW: Exam-specific conventions per (purpose × writingType) ──
// These are hardcoded expert rules — NOT for the AI to guess at.
export const EXAM_CONVENTIONS = {
  hkdse: {
    _global: `EXAM CONTEXT — HKDSE (Hong Kong DSE English Paper 2):
- Register must match the task: formal for letters/emails/reports, semi-formal to informal for stories/blogs.
- Examiners reward clear organisation with logical paragraphing. Each paragraph must serve a distinct purpose.
- Candidates are marked on Content, Language, and Organisation. All three matter equally.
- Word count guidelines matter — significantly under or over target loses marks.
- Mixed code (Cantonese/English) is NOT acceptable in the exam. All content must be in English.`,
    essay: `HKDSE ARGUMENTATIVE ESSAY RULES — CRITICAL:
- The student MUST take a CLEAR position and maintain it consistently throughout the entire essay.
- Suggesting "write both sides equally" or "present a balanced view" is WRONG for HKDSE. This loses marks.
- The thesis must appear in the introduction and every body paragraph must support that thesis.
- Counter-arguments are acceptable ONLY as brief acknowledgements that are immediately rebutted. They must never be given equal weight.
- The conclusion must firmly restate the position — never end with "it depends" or "both sides have merit".
- DO NOT suggest techniques like "explore multiple perspectives equally" or "show empathy for the opposing view" — examiners penalise indecisive essays.
- BODY PARAGRAPH STRUCTURE — NON-NEGOTIABLE. Every body paragraph MUST contain all four: (1) Topic Sentence, (2) Elaboration (2-3 sentences explaining WHY the point is true, developing the cause-and-effect logic), (3) Example + Explanation of HOW it proves the point. ONE strong well-developed example PLUS the explicit link back to the topic sentence. Quality over quantity: one example handled with depth (named place, specific details, personal anchor, sensory specifics) beats two thin examples piled together. After the example, the student MUST write 1-2 sentences explaining HOW that example supports the argument — phrases like "What this shows is…", "This proves that…", "Notice how this confirms…" make the link explicit. An example without this explanation is a quote-drop and loses marks. Draw examples from common knowledge and HK life — recent news stories, named places / districts / institutions / brands (MTR, SCMP, Octopus, the Education Bureau, named local schools), observable everyday scenes, personal classroom anecdotes. NEVER cite invented statistics, study names with years, or precise survey numbers — students cannot verify these in an exam and examiners can tell. Soft attribution like "according to a recent SCMP report" is fine; fake "a 2015 LSE study found 6.4%" style citations are not. (4) Closing Sentence (tie back to thesis). A paragraph with only topic sentence + a thin unexplained example is shallow and loses marks. Diagnose missing elements and prompt the student to add depth and analysis.`,
    persuasive: `HKDSE PERSUASIVE WRITING RULES — CRITICAL:
- The student must argue ONE clear position throughout.
- Persuasive devices (rhetorical questions, tricolon, emotive language) are expected and rewarded.
- Counter-arguments should be raised ONLY to be dismantled, never to show balance.
- A strong call to action in the conclusion is expected.
- BODY PARAGRAPH STRUCTURE — NON-NEGOTIABLE. Every body paragraph MUST contain all four: Topic Sentence + Elaboration (2-3 sentences of WHY) + ONE strong Example + Explanation of HOW it proves the point (a single well-developed concrete case a student can actually know — HK news story, named institution, observable scene, personal classroom moment — IMMEDIATELY followed by 1-2 sentences explicitly linking it back to the topic: "What this shows is…", "This proves that…". Depth and analysis, not count: one unshakable example with explanation beats two thin unexplained ones. NEVER invented statistics or fake citations) + Closing Sentence. A persuasive paragraph without elaboration sounds preachy; without a strong example it sounds hollow; with an example but no explanation it sounds like a quote-drop. All three are mark-bearing.`,
    complaint: `HKDSE COMPLAINT LETTER RULES:
- Must use formal register throughout — no slang, no contractions, no casual expressions.
- Structure: state the problem clearly, provide specific details (dates, reference numbers), state the desired remedy.
- Tone must be firm but polite — never aggressive, sarcastic, or threatening.
- Must include appropriate salutation and sign-off (Dear Sir/Madam, Yours faithfully).`,
    email: `HKDSE FORMAL EMAIL RULES:
- Semi-formal to formal register depending on audience.
- Clear subject line awareness (even if not written, the content should reflect a focused purpose).
- Concise paragraphs with one point each.
- Appropriate opening and closing conventions.`,
    report: `HKDSE REPORT RULES:
- Must use headings/subheadings to organise sections.
- Formal, impersonal tone — avoid first person where possible.
- Structure: purpose/background → findings → recommendations.
- Factual and objective tone — avoid emotional language.`,
    story: `HKDSE NARRATIVE RULES:
- Creative writing is marked on engagement and language quality.
- A clear narrative arc is expected: setup, rising action, climax, resolution.
- Show-don't-tell is heavily rewarded — sensory details, dialogue, internal thoughts.
- Avoid cliché openings ("It was a dark and stormy night") and endings ("It was all a dream").`,
  },

  ielts_task2: {
    _global: `EXAM CONTEXT — IELTS Academic Writing Task 2:
- Must write at least 250 words. Under 250 loses marks.
- Examiners mark on: Task Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy.
- Paragraphing must be clear with topic sentences.
- Formal/semi-formal register throughout.`,
    essay: `IELTS TASK 2 ESSAY RULES — CRITICAL:
- Read the question type carefully. IELTS has DIFFERENT essay types with DIFFERENT requirements:
  • "Discuss both views and give your opinion" — MUST cover both sides, then state your view clearly.
  • "To what extent do you agree or disagree?" — Can argue one side strongly, but must acknowledge the other.
  • "Advantages and disadvantages" — MUST cover both, then give a clear overall assessment.
  • "Causes and solutions" — MUST identify causes AND suggest solutions.
- Unlike HKDSE, showing you understand multiple perspectives IS rewarded in IELTS.
- The conclusion MUST contain your clear opinion — sitting on the fence loses marks on Task Response.
- Every body paragraph needs a clear topic sentence, supporting evidence, and explanation.`,
    persuasive: `IELTS PERSUASIVE WRITING RULES:
- Strong position is acceptable but must be supported with evidence and examples.
- Over-emotional language is penalised — maintain academic objectivity even while persuading.
- Hedging language ("tends to", "it could be argued") shows lexical sophistication.`,
  },

  toefl: {
    _global: `EXAM CONTEXT — TOEFL Independent Writing:
- Target 300-400 words in 30 minutes.
- Scored on: Development, Organisation, Language Use.
- Clear 4-5 paragraph structure expected.`,
    essay: `TOEFL ESSAY RULES:
- Take a clear position and support it with specific reasons and examples.
- Personal examples and experiences are acceptable and even encouraged.
- Each body paragraph should have one clear reason with a specific supporting example.
- Transitions between paragraphs are important for the Organisation score.`,
  },

  cambridge: {
    _global: `EXAM CONTEXT — Cambridge (CAE/CPE):
- Word count limits are strict — stay within the specified range.
- Register must match the task type precisely.
- Examiners reward range of vocabulary and grammar — use varied structures.`,
    essay: `CAMBRIDGE ESSAY RULES:
- Balanced discussion IS acceptable in Cambridge essays.
- Must address all parts of the prompt — missing a required point loses marks.
- A clear conclusion with your opinion is expected.
- Use a range of linkers and discourse markers to show sophistication.`,
  },

  school: {
    _global: `CONTEXT — School Assignment:
- Follow the teacher's specific instructions carefully.
- Structure and organisation are important.
- Academic honesty — all ideas must be the student's own.`,
  },

  personal: {
    _global: `CONTEXT — Personal Writing:
- No exam constraints apply. Focus on effective communication.
- The student's voice and style choices are respected.`,
  },
};

/**
 * Get exam convention rules for a given purpose and writing type.
 * Returns a string to inject into prompts, or empty string if no rules apply.
 */
export function getExamRules(purpose, typeId) {
  if (!purpose || !EXAM_CONVENTIONS[purpose]) return "";
  const conv = EXAM_CONVENTIONS[purpose];
  const global = conv._global || "";
  const specific = conv[typeId] || "";
  if (!global && !specific) return "";
  return `\n\n${global}${specific ? `\n\n${specific}` : ""}`;
}

export const placeholders = [
  "e.g. My neighbour's dog bit me on my way to work and they refuse to pay for my torn trousers and medical bill...",
  "e.g. I want a refund for a concert because the singer wasn't even the one they advertised on the poster...",
  "e.g. An essay arguing why homework should be banned — it's basically unpaid overtime for students...",
  "e.g. A formal complaint to an airline that lost my luggage and then found it three weeks later... in another country...",
  "e.g. A persuasive letter to my school principal explaining why we need longer lunch breaks to survive the afternoon...",
  "e.g. A report on why my city should build more parks instead of another shopping mall nobody asked for...",
  "e.g. A complaint email to a restaurant that served me a salad with a live caterpillar in it — and charged extra for 'protein'...",
  "e.g. An essay discussing whether social media is making us more connected or just better at pretending we are...",
  "e.g. A formal request to my gym for a refund because the 'personal trainer' just watched YouTube the whole session...",
  "e.g. A narrative about the time I accidentally replied-all to the entire company with a meme meant for my best friend...",
  "e.g. A complaint to a hotel that advertised 'sea view' but the only water I could see was a puddle in the car park...",
  "e.g. An essay on whether robots will take our jobs or just do the boring bits we hate anyway...",
];
