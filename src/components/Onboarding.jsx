import { useState, useRef, useCallback } from "react";
import { COLORS, FONTS_LINK, writingTypes, wordCounts, placeholders } from "../constants.js";
import { keyframes, sharedStyles as s } from "../styles.js";
import { SVGIcons, FeatherIcon } from "./Icons.jsx";
import Sidebar from "./Sidebar.jsx";

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
  onStart, sidebarProps,
}) {
  const [step, setStep] = useState(1);
  const [placeholderIdx] = useState(() => Math.floor(Math.random() * placeholders.length));
  const fileInputRef = useRef(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [nameInput, setNameInput] = useState(userName || "");

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
  const showWordCount = hasName ? step === 3 : step === 4;

  const maxStep = hasName ? 3 : 4;
  const canNext =
    (showName && nameInput.trim()) ||
    (showTopic && topic.trim()) ||
    (showType && type) ||
    (showWordCount && wordCount);

  const progressDots = hasName ? 3 : 4;

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

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 24px", animation: "fadeIn 0.4s ease" }}>
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
        <div style={{ flex: 1, animation: "fadeIn 0.3s ease" }} key={step}>
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
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} style={{ ...s.btn, background: COLORS.bg3, color: COLORS.text, flex: "0 0 auto", padding: "12px 20px" }}>Back</button>
          )}
          <button
            onClick={() => {
              if (showName) { handleNameSubmit(); return; }
              if (step < maxStep) setStep(step + 1);
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
