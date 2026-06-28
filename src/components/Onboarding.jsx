import { useState, useRef, useCallback } from "react";
import { COLORS, FONTS_LINK, writingTypes, wordCounts, placeholders, writingPurposes, getExamRules } from "../constants.js";
import { keyframes, sharedStyles as s } from "../styles.js";
import { SVGIcons, FeatherIcon } from "./Icons.jsx";
import Sidebar from "./Sidebar.jsx";
import { callAI, extractTextFromImage } from "../api.js";
import { getRouteConfig } from "../ai-router.js";
import { parseTechniques } from "../utils.js";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: "Good morning", note: "Fresh mind, sharp words — let's get writing." };
  if (hour >= 12 && hour < 17) return { text: "Good afternoon", note: "Perfect time to get some words down." };
  if (hour >= 17 && hour < 21) return { text: "Good evening", note: "Winding down? Let's make this session count." };
  return { text: "Burning the midnight oil", note: "Late-night writing hits different. Let's go." };
}

export default function Onboarding({
  userName, setUserName,
  topic, setTopic, type, setType, wordCount, setWordCount,
  purpose, setPurpose,
  appliedSkill, setAppliedSkill,
  setWritingTechniques,
  onStart, sidebarProps,
}) {
  const [step, setStep] = useState(1);
  const [placeholderIdx] = useState(() => Math.floor(Math.random() * placeholders.length));
  const fileInputRef = useRef(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [nameInput, setNameInput] = useState(userName || "");
  const [skillSuggestions, setSkillSuggestions] = useState(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const skillChecked = useRef(false);
  const [writerSuggestions, setWriterSuggestions] = useState(null);
  const [writerLoading, setWriterLoading] = useState(false);
  const [topicSkills, setTopicSkills] = useState(null);
  const [topicSkillsLoading, setTopicSkillsLoading] = useState(false);

  const checkSkillMatch = useCallback(async (currentTopic, currentType, currentPurpose) => {
    if (skillChecked.current) return;
    skillChecked.current = true;
    try {
      const raw = localStorage.getItem("lyra-style-skills");
      const skills = raw ? JSON.parse(raw) : [];
      if (!skills.length) {
        setSkillSuggestions("none");
        fetchWriterSuggestions(currentTopic, currentType, currentPurpose);
        return;
      }
      setSkillLoading(true);
      const typeLabel = writingTypes.find(w => w.id === currentType)?.label || currentType;
      const examRules = getExamRules(currentPurpose, currentType);
      const examNote = examRules ? `\n\nIMPORTANT — EXAM CONTEXT: The student is writing for ${currentPurpose?.toUpperCase() || "an exam"}. Only recommend styles whose techniques are compatible with the exam's conventions. ${examRules}` : "";
      const compact = skills.map(sk => ({
        id: sk.id,
        author: sk.authorName,
        when: sk.whenToUse?.keyIdea || "",
        sig: sk.signatureStyle || "",
        tech: (sk.techniques || []).slice(0, 3).join("; "),
      }));
      const prompt = `You are a writing coach assistant. A student is about to write a ${typeLabel} about: "${currentTopic.slice(0, 200)}". They have studied these writing styles:\n\n${JSON.stringify(compact)}${examNote}\n\nPick the 1-2 best matching styles for this task. Return JSON array: [{"id":"...","reason":"one short sentence why this style fits"}]. If none fit well, return []. ONLY return the JSON array, nothing else.`;
      const matchRoute = getRouteConfig("skill_match");
      const result = await callAI("Return valid JSON only.", prompt, false, 300, matchRoute.thinkingBudget, undefined, undefined, matchRoute.model);
      const matches = JSON.parse(result.replace(/```json|```/g, "").trim());
      if (Array.isArray(matches) && matches.length > 0) {
        const enriched = matches.map(m => {
          const full = skills.find(sk => sk.id === m.id);
          return full ? { ...m, authorName: full.authorName, skill: full } : null;
        }).filter(Boolean);
        setSkillSuggestions(enriched.length ? enriched : "no-match");
      } else {
        setSkillSuggestions("no-match");
      }
    } catch (e) {
      setSkillSuggestions("no-match");
    }
    setSkillLoading(false);
  }, []);

  // Shared utilities imported from utils.js
  // parseTechniques is imported at the top of this file

  const fetchWriterSuggestions = useCallback(async (currentTopic, currentType, currentPurpose) => {
    setWriterLoading(true);
    try {
      const tLabel = writingTypes.find(w => w.id === currentType)?.label || currentType;
      const examRules = getExamRules(currentPurpose, currentType);
      const examWarning = examRules ? `\n\nCRITICAL — EXAM CONTEXT:\n${examRules}\nEvery technique you suggest MUST comply with these exam rules. Do NOT suggest any technique that would violate these conventions. For example, do NOT suggest "Show Both Sides" or "Present a Balanced View" if the exam requires a clear one-sided argument.` : "";
      const sysPrompt = "You are a friendly writing coach helping a 14-year-old English learner. You research real articles via Google Search and turn them into simple, easy-to-follow writing tips. Always search the web — do not guess. Use simple everyday English — no jargon.";
      const userPrompt = `A student is writing a ${tLabel.toLowerCase()} about: "${currentTopic.slice(0, 300)}"${examWarning}

First, understand their topic — what is it really about? What are they trying to say?

Now search the web for writing tips that specifically help with THIS topic.

Extract exactly 3 simple writing tricks the student can use RIGHT NOW.

IMPORTANT — SIMPLE LANGUAGE RULES:
- Technique names must be 2-4 everyday words a teenager would understand (e.g. "Ask a Big Question", "Paint a Picture", "Flip the Argument" — NOT "Rhetorical Interrogation" or "Anaphoric Emphasis")
- Descriptions must use words a 14-year-old knows. No jargon. Explain like you're talking to a friend.
- Examples must be about the student's topic and feel real — like something a student would actually write.

For each technique, provide these 4 clearly labeled parts:
1. **Technique name** — 2-4 simple everyday words. Must sound like advice from a friend, not a textbook.
2. **What to do** — ONE short sentence (max 20 words). Show the contrast: "Instead of [plain way], try [better way]."
3. **Example** — Show BOTH versions using the student's topic. Label them "Before:" and "After:" — both are valid, the "After" just uses the trick. Keep each to one sentence.
4. **Source** — the article as a markdown link: [Article Title](https://url)

Format as 3 numbered sections.`;

      // Try up to 2 attempts — grounding can be inconsistent
      let suggestions = null;
      for (let attempt = 0; attempt < 2 && !suggestions; attempt++) {
        const writerRoute = getRouteConfig("writer_search");
        const result = await callAI(sysPrompt, userPrompt, true, 2048, writerRoute.thinkingBudget, undefined, undefined, writerRoute.model);
        suggestions = parseTechniques(result);
      }

      if (suggestions) {
        setWriterSuggestions(suggestions);
        // Auto-save techniques for the writing session
        if (setWritingTechniques) setWritingTechniques(suggestions);
        // Save as a skill in lyra-style-skills
        try {
          const tLabel = writingTypes.find(w => w.id === currentType)?.label || currentType;
          const skill = {
            id: "skill_" + Date.now(),
            authorName: `Lyra Research — ${tLabel}`,
            type: "researched",
            whenToUse: {
              keyIdea: `Useful for any ${tLabel.toLowerCase()} task`,
              bullets: suggestions.map(t => t.technique),
            },
            signatureStyle: `${suggestions.length} web-researched writing techniques`,
            techniques: suggestions.map(t => t.technique),
            researchedTechniques: suggestions,
            savedAt: new Date().toISOString(),
          };
          const existing = JSON.parse(localStorage.getItem("lyra-style-skills") || "[]");
          // Avoid duplicates: replace any existing researched skill for same type
          const filtered = existing.filter(s => !(s.type === "researched" && s.authorName === skill.authorName));
          filtered.push(skill);
          localStorage.setItem("lyra-style-skills", JSON.stringify(filtered));
        } catch (e) { /* silent */ }
      } else {
        setWriterSuggestions("error");
      }
    } catch (e) {
      setWriterSuggestions("error");
    }
    setWriterLoading(false);
  }, []);

  const searchTopicSkills = useCallback(async () => {
    if (!topic.trim() || !type) return;
    setTopicSkillsLoading(true);
    setTopicSkills(null);
    try {
      const tLabel = writingTypes.find(w => w.id === type)?.label || type;
      const examRules = getExamRules(purpose, type);
      const examWarning = examRules ? `\n\nCRITICAL — EXAM CONTEXT:\n${examRules}\nEvery technique you suggest MUST comply with these exam rules. Do NOT suggest any technique that would violate these conventions. For example, do NOT suggest "Show Both Sides" or "Present a Balanced View" if the exam requires a clear one-sided argument.` : "";
      const sysPrompt = "You are a friendly writing coach helping a 14-year-old English learner. You search real articles via Google Search and turn expert advice into simple, fun writing tricks. Always search the web — do not guess. Use simple everyday English — no jargon.";
      const userPrompt = `A student is writing a ${tLabel.toLowerCase()} about: "${topic.slice(0, 400)}"${examWarning}

First, understand their topic — what is it really about? What would a teenager find tricky about writing this?

Now search the web for writing tips that specifically help with THIS topic. Do NOT search for generic essay advice — find tricks that help with THIS subject.

Extract exactly 4 simple writing tricks tailored to this topic.

IMPORTANT — SIMPLE LANGUAGE RULES:
- Technique names must be 2-4 everyday words a teenager would understand (e.g. "Start with a Shock", "Use Real Numbers", "Crush the Counter", "End with a Punch" — NOT "Rhetorical Interrogation" or "Counter-Argument Integration")
- Descriptions must use words a 14-year-old knows. No jargon. Explain like you're chatting with a friend.
- Examples must be about the student's actual topic and feel real — like something a student would write in class.

For each technique, provide these 4 clearly labeled parts:
1. **Technique name** — 2-4 simple everyday words. Must sound like advice from a friend, not a textbook.
2. **What to do** — ONE short sentence (max 20 words). Show the contrast: "Instead of [plain way], try [better way]."
3. **Example** — Show BOTH versions using the student's topic. Label them "Before:" and "After:" — both are valid, the "After" just uses the trick. Keep each to one sentence.
4. **Source** — the article as a markdown link: [Article Title](https://url)

Format as 4 numbered sections.`;

      let results = null;
      for (let attempt = 0; attempt < 2 && !results; attempt++) {
        const writerRoute = getRouteConfig("writer_search");
        const result = await callAI(sysPrompt, userPrompt, true, 2048, writerRoute.thinkingBudget, undefined, undefined, writerRoute.model);
        results = parseTechniques(result);
      }

      if (results) {
        setTopicSkills(results);
        if (setWritingTechniques) setWritingTechniques(results);
        // Save as a skill in lyra-style-skills
        try {
          const skill = {
            id: "skill_" + Date.now(),
            authorName: `Topic Skills — ${tLabel}`,
            type: "researched",
            whenToUse: { keyIdea: `Techniques for writing about ${topic.slice(0, 80)}` },
            signatureStyle: `${results.length} topic-matched writing techniques`,
            techniques: results.map(t => t.technique),
            researchedTechniques: results,
            savedAt: new Date().toISOString(),
          };
          const existing = JSON.parse(localStorage.getItem("lyra-style-skills") || "[]");
          const filtered = existing.filter(s => !(s.type === "researched" && s.authorName === skill.authorName));
          filtered.push(skill);
          localStorage.setItem("lyra-style-skills", JSON.stringify(filtered));
        } catch (e) { /* silent */ }
      } else {
        setTopicSkills("error");
      }
    } catch (e) {
      setTopicSkills("error");
    }
    setTopicSkillsLoading(false);
  }, [topic, type, purpose, setWritingTechniques]);

  const greeting = getGreeting();
  const typeLabel = type ? writingTypes.find(w => w.id === type)?.label : "";
  const wcLabel = wordCount === "600+" ? "600+" : wordCount;
  const totalWritings = sidebarProps.projects.reduce((sum, p) => sum + p.writings.length, 0);

  const handleNameSubmit = useCallback(() => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setUserName(trimmed);
      setStep(2);
    }
  }, [nameInput, setUserName]);

  const handlePhotoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      const mediaType = file.type || "image/jpeg";
      setUploadedImage(reader.result);
      setScanning(true);
      try {
        const extracted = await extractTextFromImage({
          base64,
          mediaType,
          prompt: "Extract the writing task, essay question, or assignment prompt from this image. Return ONLY the text of the task/question — no commentary, no explanation. If there are multiple questions, extract all of them.",
          model: getRouteConfig("ocr").model,
        });
        if (extracted) setTopic(prev => prev ? prev + "\n\n" + extracted : extracted);
      } catch (err) { /* silent */ }
      setScanning(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [setTopic]);

  // If user already has a name saved, skip step 1 (name) and start at step 2 (topic)
  const hasName = !!userName;
  const showName = !hasName && step === 1;
  const showTopic = hasName ? step === 1 : step === 2;
  const showType = hasName ? step === 2 : step === 3;
  const showPurpose = hasName ? step === 3 : step === 4;
  const showWordCount = hasName ? step === 4 : step === 5;

  const maxStep = hasName ? 4 : 5;
  const canNext =
    (showName && nameInput.trim()) ||
    (showTopic && topic.trim()) ||
    (showType && type) ||
    (showPurpose && purpose) ||
    (showWordCount && wordCount);

  const progressDots = hasName ? 4 : 5;

  return (
    <div style={s.app}>
      <style>{keyframes}</style>
      <link href={FONTS_LINK} rel="stylesheet" />

      {/* Top bar with hamburger */}
      <div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <button onClick={() => sidebarProps.setSidebarOpen(true)} style={{ width: 36, height: 36, borderRadius: 18, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: COLORS.muted, position: "relative" }}>
          ☰
          {totalWritings > 0 && (
            <div style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: 8, background: COLORS.blue, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{totalWritings > 99 ? "99" : totalWritings}</div>
          )}
        </button>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 24px", animation: "fadeIn 0.4s ease", minHeight: 0 }}>
        {/* Header with greeting */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}><FeatherIcon size={28} /></div>
          <h1 style={{ fontFamily: "'Special Elite', cursive", fontSize: 26, color: COLORS.heading, margin: 0, letterSpacing: 1 }}>Lyra</h1>
          {userName ? (
            <>
              <p style={{ fontSize: 20, margin: "14px 0 0", color: COLORS.heading, fontWeight: 700, lineHeight: 1.4 }}>
                {greeting.text}, {userName}
              </p>
              <p style={{ color: COLORS.muted, fontSize: 13, margin: "6px 0 0" }}>{greeting.note}</p>
            </>
          ) : (
            <>
              <p style={{ color: COLORS.muted, fontSize: 13, margin: "8px 0 0" }}>Your AI writing coach</p>
              <p style={{ color: COLORS.heading, fontSize: 14, fontWeight: 700, margin: "14px 0 0", lineHeight: 1.5, letterSpacing: 0.3 }}>We won't write it for you.<br/>But we'll make you scary good at it.</p>
            </>
          )}
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
          {Array.from({ length: progressDots }, (_, i) => i + 1).map(i => (
            <div key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, background: i <= step ? COLORS.heading : COLORS.border, transition: "all 0.3s" }} />
          ))}
        </div>

        {/* Step Content */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, animation: "fadeIn 0.3s ease" }} key={step}>
          {/* Step: Name (new users only) */}
          {showName && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <h2 style={{ fontFamily: "'Courier Prime', monospace", fontSize: 19, fontWeight: 700, color: COLORS.heading, marginBottom: 6 }}>{greeting.text}!</h2>
                <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 24 }}>What should we call you?</p>
              </div>
              <input
                autoFocus
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && nameInput.trim()) handleNameSubmit(); }}
                placeholder="Your first name"
                style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: "'Courier Prime', monospace", fontSize: 16, color: COLORS.text, textAlign: "center", boxSizing: "border-box", outline: "none" }}
              />
              <p style={{ color: COLORS.accent2, fontSize: 11, textAlign: "center", marginTop: 10 }}>This helps Lyra personalise your coaching experience</p>
            </div>
          )}

          {/* Step: Topic */}
          {showTopic && (
            <div>
              <h2 style={{ fontFamily: "'Courier Prime', monospace", fontSize: 19, fontWeight: 700, color: COLORS.heading, marginBottom: 6 }}>What are you writing about?</h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>Describe your task or upload a photo of the question</p>

              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />

              {uploadedImage ? (
                <div style={{ marginBottom: 14, position: "relative" }}>
                  <img src={uploadedImage} alt="Uploaded" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 12, border: `1.5px solid ${COLORS.border}` }} />
                  {scanning && (
                    <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: "rgba(247,245,242,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <div style={{ animation: "featherWrite 1.8s ease-in-out infinite" }}><FeatherIcon size={28} /></div>
                      <div style={{ fontSize: 12, color: COLORS.muted }}>Reading your question...</div>
                    </div>
                  )}
                  <button onClick={() => { setUploadedImage(null); }} style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, background: COLORS.card, border: `1.5px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13, color: COLORS.muted }}>×</button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", padding: "16px", borderRadius: 14, border: `1.5px dashed ${COLORS.border}`, background: COLORS.bg2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14, transition: "all 0.2s" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={COLORS.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span style={{ fontFamily: "'Courier Prime', monospace", fontSize: 13, color: COLORS.muted }}>Upload a photo of your question</span>
                </button>
              )}

              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={placeholders[placeholderIdx]}
                style={{ width: "100%", minHeight: 110, padding: 16, borderRadius: 14, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: "'Courier Prime', monospace", fontSize: 14, color: COLORS.text, resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
              />
            </div>
          )}

          {/* Step: Type */}
          {showType && (
            <div>
              <h2 style={{ fontFamily: "'Courier Prime', monospace", fontSize: 19, fontWeight: 700, color: COLORS.heading, marginBottom: 6 }}>What type of writing?</h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>Choose the format that fits your task</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {writingTypes.map(wt => (
                  <div
                    key={wt.id}
                    onClick={() => setType(wt.id)}
                    style={{ ...s.card, cursor: "pointer", textAlign: "center", padding: "20px 12px", border: type === wt.id ? `2px solid ${COLORS.heading}` : `1.5px solid ${COLORS.border}`, transition: "all 0.2s", transform: type === wt.id ? "scale(1.02)" : "scale(1)" }}
                  >
                    <SVGIcons type={wt.icon} />
                    <div style={{ fontSize: 12, marginTop: 8, fontWeight: type === wt.id ? 700 : 400, color: type === wt.id ? COLORS.heading : COLORS.muted }}>{wt.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: Purpose / Exam Context */}
          {showPurpose && (
            <div>
              <h2 style={{ fontFamily: "'Courier Prime', monospace", fontSize: 19, fontWeight: 700, color: COLORS.heading, marginBottom: 6 }}>What's this for?</h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>This helps Lyra follow the right rules for your exam or assignment</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {writingPurposes.map(wp => (
                  <div
                    key={wp.id}
                    onClick={() => setPurpose(wp.id)}
                    style={{
                      ...s.card, cursor: "pointer", padding: "14px 16px",
                      display: "flex", alignItems: "center", gap: 12,
                      border: purpose === wp.id ? `2px solid ${COLORS.heading}` : `1.5px solid ${COLORS.border}`,
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 9,
                      border: purpose === wp.id ? `5px solid ${COLORS.heading}` : `2px solid ${COLORS.border}`,
                      flexShrink: 0, transition: "all 0.2s",
                    }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: purpose === wp.id ? 700 : 500, color: purpose === wp.id ? COLORS.heading : COLORS.text }}>{wp.label}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{wp.description}</div>
                    </div>
                  </div>
                ))}
              </div>
              {purpose && getExamRules(purpose, type) && (
                <div style={{ ...s.card, marginTop: 14, borderLeft: `3px solid ${COLORS.green}`, background: COLORS.bg2, animation: "fadeUp 0.3s ease" }}>
                  <div style={{ fontSize: 11, color: COLORS.green, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>Exam rules active</div>
                  <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>
                    Lyra will follow {writingPurposes.find(p => p.id === purpose)?.label} marking conventions for your {typeLabel.toLowerCase()}. Suggestions and coaching will respect exam-specific requirements.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Word Count */}
          {showWordCount && (
            <div>
              <h2 style={{ fontFamily: "'Courier Prime', monospace", fontSize: 19, fontWeight: 700, color: COLORS.heading, marginBottom: 6 }}>Word count goal</h2>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>How long should your piece be?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
                {wordCounts.map(wc => (
                  <div key={wc} onClick={() => setWordCount(wc)} style={{ ...s.chip, ...(wordCount === wc ? s.chipActive : {}) }}>
                    {typeof wc === "number" ? `${wc} words` : wc}
                  </div>
                ))}
              </div>
              {/* Skill suggestion card */}
              {skillLoading && (
                <div style={{ ...s.card, borderLeft: `3px solid ${COLORS.accent1}`, marginBottom: 12, animation: "fadeUp 0.3s ease" }}>
                  <div style={{ fontSize: 11, color: COLORS.accent1, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Lyra suggests</div>
                  <div style={{ fontSize: 12, color: COLORS.muted, animation: "pulse 1.5s ease-in-out infinite" }}>Checking your style skills...</div>
                </div>
              )}

              {Array.isArray(skillSuggestions) && (
                <div style={{ ...s.card, borderLeft: `3px solid ${COLORS.green}`, marginBottom: 12, animation: "fadeUp 0.3s ease" }}>
                  <div style={{ fontSize: 11, color: COLORS.green, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Matching skills found</div>
                  {skillSuggestions.map((match, i) => {
                    const isApplied = appliedSkill?.id === match.skill?.id;
                    return (
                      <div key={i} style={{ padding: "10px 0", borderTop: i > 0 ? `1px solid ${COLORS.border}` : "none" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading }}>{match.authorName}</div>
                        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{match.reason}</div>
                        <button
                          onClick={() => {
                            if (match.skill) {
                              setAppliedSkill(isApplied ? null : match.skill);
                            }
                          }}
                          style={{
                            marginTop: 8, padding: "6px 16px", borderRadius: 14,
                            border: `1.5px solid ${isApplied ? COLORS.green : COLORS.accent1}`,
                            background: isApplied ? COLORS.green : "transparent",
                            fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700,
                            color: isApplied ? "#fff" : COLORS.accent1,
                            cursor: "pointer", transition: "all 0.2s",
                          }}
                        >
                          {isApplied ? "✓ Applied" : "Write with this skill"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Discover Skills — topic-aware search */}
              {!skillLoading && (
                skillSuggestions === "no-match" ||
                Array.isArray(skillSuggestions) ||
                (skillSuggestions === "none" && !writerLoading && !Array.isArray(writerSuggestions))
              ) && (
                <div style={{ ...s.card, borderLeft: `3px solid ${COLORS.accent1}`, marginBottom: 12, animation: "fadeUp 0.3s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 14 }}>{"\uD83D\uDD0D"}</span>
                    <div style={{ fontSize: 11, color: COLORS.accent1, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Discover Skills</div>
                  </div>

                  {!topicSkills && !topicSkillsLoading && (
                    <>
                      <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5, marginBottom: 10 }}>
                        Lyra can search for writing techniques matched to your specific topic and content.
                      </div>
                      <button
                        onClick={searchTopicSkills}
                        disabled={!topic.trim() || !type}
                        style={{
                          padding: "8px 20px", borderRadius: 14,
                          border: `1.5px solid ${COLORS.accent1}`,
                          background: "transparent",
                          fontFamily: "'Courier Prime', monospace", fontSize: 12, fontWeight: 700,
                          color: COLORS.accent1, cursor: "pointer",
                          opacity: (!topic.trim() || !type) ? 0.4 : 1,
                          transition: "all 0.2s",
                        }}
                      >
                        Find skills for my topic
                      </button>
                    </>
                  )}

                  {topicSkillsLoading && (
                    <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>
                      <div style={{ animation: "pulse 1.5s ease-in-out infinite" }}>
                        Analysing your topic and searching for relevant techniques...
                      </div>
                    </div>
                  )}

                  {Array.isArray(topicSkills) && (
                    <>
                      <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5, marginBottom: 10 }}>
                        {topicSkills.length} techniques matched to your topic:
                      </div>
                      {topicSkills.map((t, i) => (
                        <div key={i} style={{ padding: "10px 0", borderTop: i > 0 ? `1px solid ${COLORS.border}` : "none" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, marginBottom: 4 }}>
                            <span style={{ color: COLORS.accent1, marginRight: 6 }}>{"\u2726"}</span>{t.technique}
                          </div>
                          {t.description && (
                            <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5, marginBottom: 4, whiteSpace: "pre-line" }}>{t.description}</div>
                          )}
                          {t.example && (
                            <div style={{ fontSize: 11, color: COLORS.text, lineHeight: 1.5, padding: "6px 10px", marginTop: 4, marginBottom: 4, background: COLORS.bg2, borderRadius: 6, borderLeft: `2px solid ${COLORS.accent1}`, fontStyle: "italic", whiteSpace: "pre-line" }}>
                              {t.example}
                            </div>
                          )}
                          {t.source && t.url && (
                            <div style={{ textAlign: "right", marginTop: 4 }}>
                              <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: COLORS.accent1, textDecoration: "none" }}>
                                {t.source} {"\u2197"}
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
                        <button
                          onClick={() => { setTopicSkills(null); searchTopicSkills(); }}
                          style={{ padding: "6px 16px", borderRadius: 14, border: `1.5px solid ${COLORS.border}`, background: "transparent", fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, color: COLORS.muted, cursor: "pointer", transition: "all 0.2s" }}
                        >
                          Search again
                        </button>
                        <button
                          onClick={() => sidebarProps.setShowStyleLab(true)}
                          style={{ padding: "6px 16px", borderRadius: 14, border: `1.5px solid ${COLORS.accent1}`, background: "transparent", fontFamily: "'Courier Prime', monospace", fontSize: 11, fontWeight: 700, color: COLORS.accent1, cursor: "pointer", transition: "all 0.2s" }}
                        >
                          Open Style Lab
                        </button>
                      </div>
                    </>
                  )}

                  {topicSkills === "error" && (
                    <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>
                      Couldn't find skills right now.{" "}
                      <span style={{ color: COLORS.accent1, cursor: "pointer", fontWeight: 700 }} onClick={() => { setTopicSkills(null); searchTopicSkills(); }}>Try again</span>
                    </div>
                  )}
                </div>
              )}

              {topic && type && wordCount && (
                <div style={{ ...s.card, background: COLORS.bg2, animation: "fadeUp 0.3s ease" }}>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.5 }}>Session Summary</div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Topic:</strong> {topic.slice(0, 80)}{topic.length > 80 ? "..." : ""}</div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Type:</strong> {typeLabel}</div>
                  <div style={{ fontSize: 13 }}><strong>Target:</strong> {wcLabel} words</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexShrink: 0 }}>
          {step > 1 && (
            <button onClick={() => { if (showWordCount) { skillChecked.current = false; setSkillSuggestions(null); setWriterSuggestions(null); setTopicSkills(null); } setStep(step - 1); }} style={{ ...s.btn, background: COLORS.bg3, color: COLORS.text, flex: "0 0 auto", padding: "12px 20px" }}>Back</button>
          )}
          <button
            onClick={() => {
              if (showName) { handleNameSubmit(); return; }
              if (step < maxStep) {
                // Trigger skill match when moving from purpose → wordCount step
                if (showPurpose && topic && type) {
                  checkSkillMatch(topic, type, purpose);
                }
                setStep(step + 1);
              }
              else onStart();
            }}
            disabled={!canNext}
            style={{ ...s.btn, flex: 1, ...(!canNext ? s.btnDisabled : {}) }}
          >
            {showWordCount ? "Start Writing" : "Next"}
          </button>
        </div>
      </div>
      <Sidebar {...sidebarProps} />
    </div>
  );
}
