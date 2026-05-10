import { useState, useRef, useCallback } from "react";
import { COLORS, FONTS_LINK, writingTypes, wordCounts, writingPurposes, getExamRules } from "../constants.js";
import { keyframes, sharedStyles as s } from "../styles.js";
import { FeatherIcon } from "./Icons.jsx";
import Sidebar from "./Sidebar.jsx";
import { callAI } from "../api.js";
import { getRouteConfig } from "../ai-router.js";
import { styleProfilerPrompt } from "../prompts.js";
import XRayView, { parseProfileSections, extractAuthor, saveStyleSkill, mono } from "./XRayView.jsx";

export default function SourceSetup({
  userName, setUserName,
  topic, setTopic, type, setType, wordCount, setWordCount,
  purpose, setPurpose,
  sourceText, setSourceText,
  sourceAnalysis, setSourceAnalysis,
  extractedSkills, setExtractedSkills,
  targetVoice, setTargetVoice,
  appliedSkill, setAppliedSkill,
  setWritingTechniques,
  onStart, trackCall,
  sidebarProps, onOpenTraining,
}) {
  const [step, setStep] = useState(1); // 1=source, 2=xray, 3=mission
  const [nameInput, setNameInput] = useState(userName || "");
  const [analyzing, setAnalyzing] = useState(false);
  const [profileSections, setProfileSections] = useState([]);
  const [authorName, setAuthorName] = useState("");
  const [skillSaved, setSkillSaved] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [scanning, setScanning] = useState(false);

  // Mission step — sub-step for 2-step mission
  const [missionStep, setMissionStep] = useState(1); // 1=topic+type, 2=purpose+wordcount

  const hasName = !!userName;
  const sourceWordCount = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;
  const totalWritings = sidebarProps.projects.reduce((sum, p) => sum + p.writings.length, 0);

  // ── Name submit ──
  const handleNameSubmit = useCallback(() => {
    const trimmed = nameInput.trim();
    if (trimmed) setUserName(trimmed);
  }, [nameInput, setUserName]);

  // ── Photo upload for source text OCR ──
  const handleSourcePhotoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      const mediaType = file.type || "image/jpeg";
      setUploadedImage(reader.result);
      setScanning(true);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 2000,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
                { type: "text", text: "Extract ALL the text from this image. Return ONLY the extracted text — no commentary, no explanation. Preserve paragraphs and line breaks." }
              ]
            }]
          }),
        });
        const data = await res.json();
        const extracted = data.content?.map(b => b.text || "").filter(Boolean).join("\n") || "";
        if (extracted) setSourceText(extracted);
      } catch (err) { /* silent */ }
      setScanning(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [setSourceText]);

  // ── Photo upload for exam question (mission step) ──
  const topicFileRef = useRef(null);
  const [topicScanning, setTopicScanning] = useState(false);
  const handleTopicPhotoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      const mediaType = file.type || "image/jpeg";
      setTopicScanning(true);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1000,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
                { type: "text", text: "Extract the writing task, essay question, or assignment prompt from this image. Return ONLY the text of the task/question — no commentary, no explanation. If there are multiple questions, extract all of them." }
              ]
            }]
          }),
        });
        const data = await res.json();
        const extracted = data.content?.map(b => b.text || "").filter(Boolean).join("\n") || "";
        if (extracted) setTopic(prev => prev ? prev + "\n\n" + extracted : extracted);
      } catch (err) { /* silent */ }
      setTopicScanning(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [setTopic]);

  // ── Analyse source text (X-Ray) ──
  const analyzeSource = useCallback(async () => {
    if (!sourceText.trim() || sourceWordCount < 80) return;
    setAnalyzing(true);
    setError("");
    try {
      // Cross-author technique referencing
      let existingSkillsCtx = "";
      try {
        const saved = JSON.parse(localStorage.getItem("lyra-style-skills") || "[]");
        if (saved.length > 0) {
          const skillList = saved.flatMap(sk => {
            const techs = sk.analysedTechniques || sk.researchedTechniques || (sk.techniques || []).map(t => typeof t === "string" ? { technique: t } : t);
            return techs.map(t => t.technique);
          }).filter(Boolean);
          if (skillList.length > 0) {
            existingSkillsCtx = `\n\nCROSS-REFERENCE: The student has previously studied these techniques from other authors: ${skillList.join(", ")}. If this new text uses any of the SAME techniques, mention the connection: "This writer also uses [technique] (like in your previous analysis), but [how they use it differently]." Only mention genuine overlaps — do not force connections.`;
          }
        }
      } catch (e) { /* silent */ }
      const userMsg = sourceText + existingSkillsCtx;

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
        setSourceAnalysis(result);
        const author = extractAuthor(result);
        setAuthorName(author);
        const sections = parseProfileSections(result);
        if (sections.length === 0) {
          setProfileSections([{ title: "STYLE ANALYSIS", content: result }]);
        } else {
          setProfileSections(sections);
          const savedSkill = saveStyleSkill(author, sections);
          setSkillSaved(savedSkill ? "saved" : "too-short");
          // Extract skills for the new flow
          if (savedSkill) {
            setExtractedSkills(savedSkill.analysedTechniques || []);
            setTargetVoice(savedSkill.signatureStyle || "");
            setAppliedSkill(savedSkill);
            if (setWritingTechniques) setWritingTechniques(savedSkill.analysedTechniques || []);
          }
        }
        // Auto-advance to X-Ray step
        setStep(2);
      }
    } catch (e) {
      console.error("Source analysis error:", e);
      setError(e.message || "Analysis failed. Please try again.");
    }
    setAnalyzing(false);
  }, [sourceText, sourceWordCount, trackCall, setSourceAnalysis, setExtractedSkills, setTargetVoice, setAppliedSkill, setWritingTechniques]);

  // ── Derived ──
  const typeLabel = type ? writingTypes.find(w => w.id === type)?.label : "";

  // Current step progress
  const totalSteps = 3;
  const progressDots = totalSteps;

  const canStartWriting = topic.trim() && type && purpose && wordCount;

  return (
    <div style={s.app}>
      <style>{keyframes}</style>
      <link href={FONTS_LINK} rel="stylesheet" />

      {/* Top bar */}
      <div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <button onClick={() => sidebarProps.setSidebarOpen(true)} style={{ width: 36, height: 36, borderRadius: 18, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: COLORS.muted, position: "relative" }}>
          ☰
          {totalWritings > 0 && (
            <div style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: 8, background: COLORS.blue, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{totalWritings > 99 ? "99" : totalWritings}</div>
          )}
        </button>
        <div style={{ width: 36 }} />
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "0 18px 12px" }}>
        {Array.from({ length: progressDots }, (_, i) => (
          <div key={i} style={{ width: i + 1 === step ? 24 : 8, height: 8, borderRadius: 4, background: i + 1 <= step ? COLORS.heading : COLORS.bg3, transition: "all 0.3s" }} />
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 24px" }}>

        {/* ── STEP 1: SOURCE ── */}
        {step === 1 && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            {/* Inline name input if no saved name */}
            {!hasName && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8, fontFamily: mono }}>What's your name?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleNameSubmit(); }}
                    placeholder="Your first name..."
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: mono, fontSize: 14, color: COLORS.text }}
                  />
                  {nameInput.trim() && (
                    <button onClick={handleNameSubmit} style={{ ...s.btn, padding: "10px 18px", fontSize: 13 }}>OK</button>
                  )}
                </div>
              </div>
            )}

            {/* Source input */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <FeatherIcon size={28} color={COLORS.accent1} />
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.heading, marginTop: 10, fontFamily: "'Courier Prime', monospace" }}>
                {hasName ? `Hey ${userName}!` : "Welcome!"} Let's learn from a master.
              </div>
              <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 6, lineHeight: 1.5, fontFamily: mono }}>
                Paste or photograph a piece of writing you admire. Lyra will X-Ray it and teach you its secrets.
              </p>
            </div>

            {error && (
              <div style={{ ...s.card, marginBottom: 16, padding: 14, borderLeft: `3px solid ${COLORS.red}`, background: "#FFF5F5", maxHeight: 200, overflowY: "auto" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.red, marginBottom: 4, fontFamily: mono }}>Analysis failed</div>
                <div style={{ fontSize: 10, color: COLORS.text, lineHeight: 1.5, wordBreak: "break-all", fontFamily: mono }}>{error}</div>
              </div>
            )}

            <textarea
              value={sourceText}
              onChange={e => setSourceText(e.target.value)}
              placeholder="Paste an article, essay, letter, story, or any writing you admire..."
              style={{ width: "100%", minHeight: 180, padding: 16, borderRadius: 14, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: mono, fontSize: 13, color: COLORS.text, resize: "vertical", lineHeight: 1.7, boxSizing: "border-box" }}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: sourceWordCount >= 80 ? COLORS.green : COLORS.muted, fontFamily: mono }}>
                {sourceWordCount} word{sourceWordCount !== 1 ? "s" : ""}{sourceWordCount < 80 ? ` (need ${80 - sourceWordCount} more)` : " — ready"}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: 11, fontFamily: mono, padding: "6px 12px", borderRadius: 10, border: `1.5px dashed ${COLORS.border}`, background: "transparent", color: COLORS.muted, cursor: "pointer" }}
              >
                {scanning ? "Scanning..." : "📷 Upload photo"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleSourcePhotoUpload} />
            </div>

            {/* Analyse button */}
            <button
              onClick={analyzeSource}
              disabled={sourceWordCount < 80 || analyzing}
              style={{ ...s.btn, width: "100%", ...(sourceWordCount < 80 || analyzing ? s.btnDisabled : {}) }}
            >
              {analyzing ? "Analysing..." : "X-Ray This Writing"}
            </button>

            {/* Analysing animation */}
            {analyzing && (
              <div style={{ textAlign: "center", padding: "30px 24px" }}>
                <div style={{ animation: "featherWrite 1.8s ease-in-out infinite", display: "inline-block", marginBottom: 12 }}>
                  <FeatherIcon size={28} />
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5, fontFamily: mono }}>
                  Building a deep linguistic profile...
                </div>
              </div>
            )}

            {/* Skip link */}
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                onClick={() => setStep(3)}
                style={{ background: "none", border: "none", fontFamily: mono, fontSize: 12, color: COLORS.muted, cursor: "pointer", textDecoration: "underline", opacity: 0.7 }}
              >
                Skip — I'll write without a source
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: X-RAY ── */}
        {step === 2 && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <XRayView
              profileSections={profileSections}
              authorName={authorName}
              referenceText={sourceText}
              skillSaved={skillSaved}
              onSave={() => {}}
              analyzing={analyzing}
            />

            {profileSections.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => { setStep(1); setProfileSections([]); setSourceAnalysis(""); setAuthorName(""); setSkillSaved(null); setError(""); }}
                  style={{ flex: 1, ...s.chip, textAlign: "center", fontSize: 12 }}
                >
                  Try different text
                </button>
                <button
                  onClick={() => setStep(3)}
                  style={{ flex: 2, ...s.btn, fontSize: 14 }}
                >
                  Set My Mission →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: MISSION ── */}
        {step === 3 && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            {/* Source context indicator */}
            {authorName && profileSections.length > 0 && (
              <div style={{ ...s.card, marginBottom: 16, padding: "10px 14px", borderLeft: `3px solid ${COLORS.green}`, background: "#F0F6F1", display: "flex", alignItems: "center", gap: 8 }}>
                <FeatherIcon size={14} color={COLORS.green} />
                <div style={{ fontSize: 11, color: COLORS.heading, fontFamily: mono }}>
                  Source: <strong>{authorName}</strong> · {profileSections.filter(s => s.title !== "WHEN TO USE THIS STYLE" && s.title !== "SIGNATURE STYLE").length} techniques
                </div>
              </div>
            )}

            {missionStep === 1 ? (
              <>
                {/* Topic */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.heading, marginBottom: 8, fontFamily: "'Courier Prime', monospace" }}>
                    What are you writing about?
                  </div>
                  <textarea
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Describe your topic, or paste an exam question..."
                    style={{ width: "100%", minHeight: 80, padding: 14, borderRadius: 14, border: `1.5px solid ${COLORS.border}`, background: COLORS.bg2, fontFamily: mono, fontSize: 13, color: COLORS.text, resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <button
                      onClick={() => topicFileRef.current?.click()}
                      style={{ fontSize: 10, fontFamily: mono, padding: "4px 10px", borderRadius: 8, border: `1.5px dashed ${COLORS.border}`, background: "transparent", color: COLORS.muted, cursor: "pointer" }}
                    >
                      {topicScanning ? "Scanning..." : "📷 Scan exam question"}
                    </button>
                    <input ref={topicFileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleTopicPhotoUpload} />
                  </div>
                </div>

                {/* Writing type */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, marginBottom: 10, fontFamily: mono }}>What type of writing?</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {writingTypes.map(wt => (
                      <button
                        key={wt.id}
                        onClick={() => setType(wt.id)}
                        style={{
                          ...s.chip,
                          padding: "12px 14px",
                          textAlign: "left",
                          ...(type === wt.id ? s.chipActive : {}),
                        }}
                      >
                        {wt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setMissionStep(2)}
                  disabled={!topic.trim() || !type}
                  style={{ ...s.btn, width: "100%", ...(!topic.trim() || !type ? s.btnDisabled : {}) }}
                >
                  Next →
                </button>
              </>
            ) : (
              <>
                {/* Purpose */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.heading, marginBottom: 8, fontFamily: "'Courier Prime', monospace" }}>
                    What's this for?
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {writingPurposes.map(wp => (
                      <button
                        key={wp.id}
                        onClick={() => setPurpose(wp.id)}
                        style={{
                          ...s.chip,
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "12px 14px",
                          ...(purpose === wp.id ? s.chipActive : {}),
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{wp.label}</div>
                          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{wp.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Word count */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, marginBottom: 10, fontFamily: mono }}>Target word count</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {wordCounts.map(wc => (
                      <button
                        key={wc}
                        onClick={() => setWordCount(wc)}
                        style={{
                          ...s.chip,
                          minWidth: 48, textAlign: "center",
                          ...(wordCount === wc ? s.chipActive : {}),
                        }}
                      >
                        {wc}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setMissionStep(1)} style={{ ...s.chip, padding: "12px 18px", fontSize: 13 }}>← Back</button>
                  <button
                    onClick={onStart}
                    disabled={!canStartWriting}
                    style={{ flex: 1, ...s.btn, fontSize: 15, ...(!canStartWriting ? s.btnDisabled : {}) }}
                  >
                    Start Writing
                  </button>
                </div>
              </>
            )}

            {/* Back to source */}
            {step === 3 && missionStep === 1 && sourceText && (
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button
                  onClick={() => setStep(profileSections.length > 0 ? 2 : 1)}
                  style={{ background: "none", border: "none", fontFamily: mono, fontSize: 12, color: COLORS.muted, cursor: "pointer", textDecoration: "underline", opacity: 0.7 }}
                >
                  ← Back to source
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <Sidebar {...sidebarProps} />
    </div>
  );
}
