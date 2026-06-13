import { useState, useRef, useCallback } from "react";
import { COLORS, FONTS_LINK, writingTypes, wordCounts, writingPurposes, getExamRules, defaultXraySections } from "../constants.js";
import { keyframes, sharedStyles as s } from "../styles.js";
import { FeatherIcon, CameraIcon, GalleryIcon } from "./Icons.jsx";
import Sidebar from "./Sidebar.jsx";
import { callAI } from "../api.js";
import { getRouteConfig } from "../ai-router.js";
import { buildStyleProfilerPrompt } from "../prompts.js";
import { stripLearningData } from "../learning-sync.js";
import XRayView, { parseProfileSections, filterSectionsToRequested, extractAuthor, saveStyleSkill, mono } from "./XRayView.jsx";
import { prepareImageForOCR } from "../image-utils.js";
import { detectFormatCue, typeLabelOf } from "../genre-cues.js";

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
  // TWO inputs, both always mounted: `capture` on a file input is a hard fork
  // on Android (camera app directly, gallery never offered — the live bug), so
  // the gallery picker must be a separate capture-less input. Both .click()
  // calls stay SYNCHRONOUS in their onClick so mobile user-activation holds.
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
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
    // Reset FIRST (synchronously) so picking the SAME photo twice re-fires
    // onChange even when this attempt fails.
    e.target.value = "";
    if (!file) return;
    setScanning(true);
    setError("");
    try {
      // Transcode (HEIC→JPEG) + downscale (>2000px long edge) when needed.
      const { dataUrl, mediaType } = await prepareImageForOCR(file);
      setUploadedImage(dataUrl);
      const base64 = dataUrl.split(",")[1];
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
      if (extracted) {
        setSourceText(extracted);
      } else {
        setError("Couldn't read any text in that photo — try a clearer shot or a screenshot.");
      }
    } catch (err) {
      setError("Couldn't read that photo — try a screenshot instead.");
    }
    setScanning(false);
  }, [setSourceText]);

  // ── Photo upload for exam question (mission step) ──
  const topicGalleryRef = useRef(null);
  const topicCameraRef = useRef(null);
  const [topicScanning, setTopicScanning] = useState(false);
  const [topicScanError, setTopicScanError] = useState("");
  const handleTopicPhotoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset first — same-photo re-pick must re-fire
    if (!file) return;
    setTopicScanning(true);
    setTopicScanError("");
    try {
      const { dataUrl, mediaType } = await prepareImageForOCR(file);
      const base64 = dataUrl.split(",")[1];
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
      if (extracted) {
        setTopic(prev => prev ? prev + "\n\n" + extracted : extracted);
      } else {
        setTopicScanError("Couldn't read any text in that photo — try a clearer shot.");
      }
    } catch (err) {
      setTopicScanError("Couldn't read that photo — try a screenshot instead.");
    }
    setTopicScanning(false);
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
            existingSkillsCtx = `\n\nCROSS-REFERENCE: The student has previously studied these techniques from other authors: ${skillList.join(", ")}. If this new text uses any of the SAME techniques, mention the connection: "This writer also uses [technique] (like in your previous analysis), but [how they use it differently]." Only mention genuine overlaps — do not force connections. Refer to the connection by TECHNIQUE NAME ONLY — never "Writer A", "Writer B" or any Writer label (the student never sees those labels here).`;
          }
        }
      } catch (e) { /* silent */ }
      const userMsg = sourceText + existingSkillsCtx;

      const analysisRoute = getRouteConfig("style_analysis");
      trackCall();
      // One requested set for the prompt AND both parse sites — the clamp must
      // match what was asked for, or the curation contract drifts.
      const requestedSections = defaultXraySections(null);
      // Throttle parsing to every ~400ms — avoids O(n²) re-parsing on every token
      let lastParseAt = 0;
      let advancedToStep2 = false;
      const result = await callAI(buildStyleProfilerPrompt(requestedSections), userMsg, false, 10000, analysisRoute.thinkingBudget, (partial) => {
        const now = Date.now();
        if (now - lastParseAt < 400) return;
        lastParseAt = now;
        const clean = stripLearningData(partial);
        const author = extractAuthor(clean);
        if (author !== "Unknown Author") setAuthorName(author);
        const sections = filterSectionsToRequested(parseProfileSections(clean), requestedSections);
        if (sections.length > 0) {
          setProfileSections(sections);
          setAnalyzing(false);
          // Advance to step 2 as soon as first section appears so user sees streaming content
          if (!advancedToStep2) {
            advancedToStep2 = true;
            setStep(2);
          }
        }
      }, undefined, analysisRoute.model);

      if (!result || !result.trim()) {
        setError("No response received. Please check your API connection and try again.");
      } else {
        const clean = stripLearningData(result);
        setSourceAnalysis(clean);
        const author = extractAuthor(clean);
        setAuthorName(author);
        const sections = filterSectionsToRequested(parseProfileSections(clean), requestedSections);
        if (sections.length === 0) {
          setProfileSections([{ title: "STYLE ANALYSIS", content: clean }]);
        } else {
          setProfileSections(sections);
          const savedSkill = saveStyleSkill(author, sections, sourceText);
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

  // Step back one page through the flow: mission sub-step 2→1, then mission→X-Ray
  // (or →source if the student skipped the source), then X-Ray→source.
  const goBack = () => {
    if (step === 3 && missionStep === 2) { setMissionStep(1); return; }
    if (step === 3) { setStep(profileSections.length > 0 ? 2 : 1); return; }
    if (step === 2) { setStep(1); return; }
  };
  const canGoBack = step > 1 || missionStep > 1;

  return (
    <div style={s.app}>
      <style>{keyframes}</style>
      <link href={FONTS_LINK} rel="stylesheet" />

      {/* Top bar (menu) */}
      <div style={{ padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <button onClick={() => sidebarProps.setSidebarOpen(true)} style={{ width: 36, height: 36, borderRadius: 18, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: COLORS.muted, position: "relative" }}>
          ☰
          {totalWritings > 0 && (
            <div style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: 8, background: COLORS.blue, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{totalWritings > 99 ? "99" : totalWritings}</div>
          )}
        </button>
        <div style={{ width: 36 }} />
      </div>

      {/* Back arrow — its own row beneath the menu bar */}
      {canGoBack && (
        <div style={{ padding: "0 18px 8px", flexShrink: 0 }}>
          <button onClick={goBack} aria-label="Go back to the previous step" style={{ width: 36, height: 36, borderRadius: 18, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: COLORS.muted }}>
            ←
          </button>
        </div>
      )}

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

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 16, gap: 8 }}>
              <div style={{ fontSize: 11, color: sourceWordCount >= 80 ? COLORS.green : COLORS.muted, fontFamily: mono, flex: 1, minWidth: 0 }}>
                {sourceWordCount} word{sourceWordCount !== 1 ? "s" : ""}{sourceWordCount < 80 ? ` (need ${80 - sourceWordCount} more)` : " — ready"}
              </div>
              {scanning ? (
                <span style={{ fontSize: 11, fontFamily: mono, color: COLORS.muted, padding: "6px 12px" }}>Scanning…</span>
              ) : (
                <>
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    style={{ fontSize: 11, fontFamily: mono, padding: "6px 10px", borderRadius: 10, border: `1.5px dashed ${COLORS.border}`, background: "transparent", color: COLORS.muted, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <GalleryIcon /> Gallery
                  </button>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    style={{ fontSize: 11, fontFamily: mono, padding: "6px 10px", borderRadius: 10, border: `1.5px dashed ${COLORS.border}`, background: "transparent", color: COLORS.muted, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <CameraIcon /> Take photo
                  </button>
                </>
              )}
              <input ref={galleryInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleSourcePhotoUpload} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleSourcePhotoUpload} />
            </div>

            {/* Lyra curates the most useful lessons — frames the 2-3 section output
                as a choice, and pre-frames the later "Analyse more" expansion. */}
            <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: mono, textAlign: "left", marginBottom: 16 }}>
              Lyra will pick the {defaultXraySections(null).length} most useful lessons from this writing
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
              trackCall={trackCall}
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
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
                    {topicScanning ? (
                      <span style={{ fontSize: 10, fontFamily: mono, color: COLORS.muted, padding: "4px 10px" }}>Scanning…</span>
                    ) : (
                      <>
                        <button
                          onClick={() => topicGalleryRef.current?.click()}
                          style={{ fontSize: 10, fontFamily: mono, padding: "4px 10px", borderRadius: 8, border: `1.5px dashed ${COLORS.border}`, background: "transparent", color: COLORS.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <GalleryIcon size={12} /> Gallery
                        </button>
                        <button
                          onClick={() => topicCameraRef.current?.click()}
                          style={{ fontSize: 10, fontFamily: mono, padding: "4px 10px", borderRadius: 8, border: `1.5px dashed ${COLORS.border}`, background: "transparent", color: COLORS.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <CameraIcon size={12} /> Scan exam question
                        </button>
                      </>
                    )}
                    <input ref={topicGalleryRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleTopicPhotoUpload} />
                    <input ref={topicCameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleTopicPhotoUpload} />
                  </div>
                  {topicScanError && (
                    <div style={{ fontSize: 11, color: COLORS.red, fontFamily: mono, marginTop: 4, textAlign: "right" }}>{topicScanError}</div>
                  )}
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
                  {/* Genre-mismatch nudge: the topic contains an explicit format
                      instruction that contradicts the selected type. Non-blocking
                      — Next stays enabled, the student keeps final say. */}
                  {(() => {
                    const cue = detectFormatCue(topic);
                    if (!cue || !type || cue.typeId === type) return null;
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontFamily: mono }}>
                        <span style={{ flex: 1, fontSize: 12, color: COLORS.amber, lineHeight: 1.5 }}>
                          {/* Cue label and type label coincide now that letter-to-editor
                              and speech are real types — don't say the name twice. */}
                          Your question asks for a {cue.cueLabel}{typeLabelOf(cue.typeId) !== cue.cueLabel ? ` — ${typeLabelOf(cue.typeId)} fits best` : ""}
                        </span>
                        <button
                          onClick={() => setType(cue.typeId)}
                          style={{ fontSize: 11, fontFamily: mono, padding: "4px 12px", borderRadius: 8, border: `1.5px solid ${COLORS.amber}`, background: "transparent", color: COLORS.amber, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                          Use it
                        </button>
                      </div>
                    );
                  })()}
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
          </div>
        )}
      </div>

      {/* Sidebar */}
      <Sidebar {...sidebarProps} />
    </div>
  );
}
