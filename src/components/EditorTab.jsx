import { useState, useRef, useEffect } from "react";
import { COLORS } from "../constants.js";
import { sharedStyles as s } from "../styles.js";
import { FeatherIcon } from "./Icons.jsx";
import MiniLessonCard from "./MiniLessonCard.jsx";
import { SavedSkills } from "./StyleLab.jsx";
import { parseStructureContent } from "./XRayView.jsx";
import { groupGrammarByRule } from "../utils.js";

const mono = "'Courier Prime', monospace";

const ROLE_COLORS = {
  hook: "#C47C0A", point: "#3A8FBF", evidence: "#6B9E78",
  explanation: "#9E9A96", link: "#B8B4AF", conclusion: "#C47C0A",
};
const ROLE_LABELS = {
  hook: "Hook", point: "Point", evidence: "Evidence",
  explanation: "Explain", link: "Link", conclusion: "Conclude",
};

export default function EditorTab({
  draft, setDraft, wordCount, currentWords, progress, goalReached, wcLabel,
  suggestions, setSuggestions, sugBadge, setSugBadge, applySuggestion,
  proofread, setProofread, proofTab, setProofTab, proofLoading, runProofread, cancelProofread, checkFlash,
  miniLesson, fetchMiniLesson, sendChat, setTab,
  writingTechniques,
  appliedSkill,
  setWritingTechniques,
  techsEnriching,
  onApplySkill,
  pendingSkillsOpen,
  setPendingSkillsOpen,
  onOpenTraining,
}) {
  const textareaRef = useRef(null);
  const [activeTechIdx, setActiveTechIdx] = useState(null);
  const [showSkills, setShowSkills] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [expandedRules, setExpandedRules] = useState(() => new Set()); // §59: which grammar rule-cards show all instances
  const toggleRule = (i) => setExpandedRules(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const INSTANCE_PREVIEW = 3; // show first N instances per rule, then "and X more"

  // Blank page nudge — show after 60s if editor is still empty
  useEffect(() => {
    if (currentWords >= 20) { setShowNudge(false); return; }
    const timer = setTimeout(() => {
      if (currentWords < 20) setShowNudge(true);
    }, 60000);
    return () => clearTimeout(timer);
  }, [currentWords]);

  // Auto-open skills panel when requested from Chat tab
  useEffect(() => {
    if (pendingSkillsOpen) {
      setShowSkills(true);
      setPendingSkillsOpen(false);
    }
  }, [pendingSkillsOpen, setPendingSkillsOpen]);

  const hasTechniques = writingTechniques?.length > 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Editor toolbar */}
      <div style={{ padding: "8px 18px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <button onClick={() => setShowSkills(!showSkills)} style={{ ...s.chip, fontSize: 12, display: "flex", alignItems: "center", gap: 4, background: showSkills ? COLORS.heading : COLORS.card, color: showSkills ? "#fff" : COLORS.heading, borderColor: showSkills ? COLORS.heading : COLORS.border, transition: "all 0.2s", flexShrink: 0 }}>
          {"\u2726"} Skills
        </button>
        <button onClick={runProofread} disabled={!draft.trim() || proofLoading} style={{ ...s.chip, fontSize: 12, display: "flex", alignItems: "center", gap: 4, opacity: (!draft.trim() || proofLoading) ? 0.4 : 1, background: checkFlash ? COLORS.green : (draft.trim() ? COLORS.card : COLORS.bg2), color: checkFlash ? "#fff" : COLORS.text, borderColor: checkFlash ? COLORS.green : COLORS.border, transition: "all 0.3s ease", flexShrink: 0 }}>
          {checkFlash ? "\u2713 Logged!" : "Proofread"}
        </button>
      </div>

      {/* Skills picker panel */}
      {showSkills && (
        <div style={{ borderBottom: `1.5px solid ${COLORS.accent1}`, background: COLORS.bg2, flexShrink: 0, animation: "fadeIn 0.2s ease", maxHeight: 320, overflowY: "auto", padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.heading, fontFamily: mono }}>Deploy a Skill</div>
            <button onClick={() => setShowSkills(false)} style={{ background: "none", border: "none", fontSize: 16, color: COLORS.muted, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}>{"\u00d7"}</button>
          </div>
          <SavedSkills onApply={(skill) => { onApplySkill(skill); setShowSkills(false); }} onPractice={onOpenTraining ? (skill, techIdx) => { onOpenTraining(skill, techIdx); if (!Number.isInteger(techIdx)) setShowSkills(false); } : null} />
        </div>
      )}

      {/* === TECHNIQUE GUIDANCE STRIP === */}
      {hasTechniques && (
        <div style={{ borderBottom: `1.5px solid ${COLORS.blue}`, background: COLORS.card, flexShrink: 0, animation: "fadeIn 0.3s ease" }}>
          {/* Header with skill name + dismiss */}
          <div style={{ padding: "8px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 11, color: COLORS.blue, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: mono, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>{"\u2726"}</span>
              {appliedSkill?.authorName || "Writing Techniques"}
              {techsEnriching && (
                <span style={{ fontSize: 9, color: COLORS.muted, fontWeight: 400, marginLeft: 8, fontStyle: "italic" }}>
                  finding more techniques...
                </span>
              )}
            </div>
            <button
              onClick={() => { if (setWritingTechniques) setWritingTechniques(null); }}
              style={{ background: "none", border: "none", fontSize: 16, color: COLORS.muted, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}
            >
              {"\u00d7"}
            </button>
          </div>

          {/* Technique list — vertical accordion */}
          <div style={{ padding: "6px 18px 10px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto", maxHeight: 360 }}>
            {writingTechniques.map((t, i) => {
              const isActive = activeTechIdx === i;
              return (
                <div key={i}>
                  <button
                    onClick={() => setActiveTechIdx(isActive ? null : i)}
                    style={{
                      width: "100%",
                      padding: "9px 14px",
                      borderRadius: isActive ? "10px 10px 0 0" : 10,
                      border: `1.5px solid ${isActive ? COLORS.blue : COLORS.border}`,
                      borderBottom: isActive ? "none" : `1.5px solid ${COLORS.border}`,
                      background: isActive ? COLORS.blue : COLORS.card,
                      color: isActive ? "#fff" : COLORS.heading,
                      fontFamily: mono,
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 400,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 10, opacity: 0.6 }}>{isActive ? "\u25BC" : "\u25B6"}</span>
                    {t.technique}
                    {t.paragraphRole && (
                      <span style={{
                        marginLeft: "auto",
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "2px 7px",
                        borderRadius: 10,
                        background: isActive ? "rgba(255,255,255,0.25)" : (ROLE_COLORS[t.paragraphRole] || COLORS.muted) + "22",
                        color: isActive ? "#fff" : (ROLE_COLORS[t.paragraphRole] || COLORS.muted),
                        letterSpacing: 0.5,
                        flexShrink: 0,
                      }}>
                        {ROLE_LABELS[t.paragraphRole] || t.paragraphRole}
                      </span>
                    )}
                  </button>
                  {isActive && (
                    <div style={{ background: COLORS.bg2, borderRadius: "0 0 10px 10px", padding: "12px 14px", borderLeft: `1.5px solid ${COLORS.blue}`, borderRight: `1.5px solid ${COLORS.blue}`, borderBottom: `1.5px solid ${COLORS.blue}`, animation: "fadeIn 0.2s ease" }}>
                      {t.paragraphRole && (
                        <div style={{ fontSize: 10, color: ROLE_COLORS[t.paragraphRole] || COLORS.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: mono }}>
                          Use for: {ROLE_LABELS[t.paragraphRole] || t.paragraphRole} sentence
                        </div>
                      )}
                      {t.description && (
                        <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.6, marginBottom: 8 }}>
                          {t.description}
                        </div>
                      )}
                      {t.structure && (() => {
                        const parsed = parseStructureContent(t.structure);
                        if (!parsed) return null;
                        return (
                          <div style={{ background: "#F0EDE8", border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: COLORS.accent1, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontFamily: mono }}>
                              Give it a go
                            </div>
                            {parsed.kind === "task-example" ? (
                              <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.heading, lineHeight: 1.5, fontFamily: mono, marginBottom: 5 }}>
                                  {parsed.intro}
                                </div>
                                <div style={{ fontSize: 11, color: COLORS.heading, lineHeight: 1.5, fontFamily: mono, marginBottom: parsed.example ? 5 : 0 }}>
                                  <span style={{ fontWeight: 700 }}>Task: </span>{parsed.task}
                                </div>
                                {parsed.example && (
                                  <div style={{ background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 5, padding: "5px 8px", color: "#6B4A20", fontFamily: mono, fontSize: 11, lineHeight: 1.5 }}>
                                    <span style={{ fontWeight: 700, color: "#A6701F" }}>Example: </span>{parsed.example}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div style={{ fontSize: 11, color: COLORS.heading, lineHeight: 1.5, fontFamily: mono }}>
                                  {parsed.template}
                                </div>
                                {parsed.kind === "template-arrow" && parsed.example && (
                                  <div style={{ marginTop: 5, background: "#FFF6E5", border: `1px solid #E8D8B4`, borderRadius: 5, padding: "5px 8px", color: "#6B4A20", fontFamily: mono, fontSize: 11, lineHeight: 1.5 }}>
                                    <span style={{ fontWeight: 700, color: "#A6701F" }}>For example: </span>{parsed.example}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                      {t.example && (
                        <div style={{ fontSize: 11, color: COLORS.muted, fontStyle: "italic", lineHeight: 1.5, borderLeft: `2px solid ${COLORS.blue}`, paddingLeft: 8 }}>
                          {t.example}
                        </div>
                      )}
                      {t.source && t.url && (
                        <div style={{ textAlign: "right", marginTop: 6 }}>
                          <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: COLORS.accent1, textDecoration: "none" }}>
                            {t.source} {"\u2197"}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Word count bar */}
      <div style={{ padding: "10px 18px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: COLORS.muted }}>{currentWords} / {wcLabel} words</span>
          {goalReached && <span style={{ color: COLORS.green, fontWeight: 700 }}>{"\u2713"} Goal reached!</span>}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: COLORS.bg3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, borderRadius: 3, background: goalReached ? COLORS.green : `linear-gradient(90deg, ${COLORS.accent1}, ${COLORS.accent2})`, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Editor area — §62: framed as a paper "sheet" (white card on the parchment
          bg) so the draft field reads as a defined page. Gutter margin lets the
          parchment show around it; the textarea stays transparent + scrolls inside.
          Toolbar above + Ask Lyra below stay OUTSIDE this frame as chrome. */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", margin: "0 18px 14px", border: `1px solid ${COLORS.border}`, borderRadius: 14, background: COLORS.card }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Start writing here... Lyra is watching and will offer guidance as you go."
          style={{ width: "100%", height: "100%", padding: "16px 18px", fontFamily: mono, fontSize: 15, lineHeight: 1.8, color: COLORS.text, background: "transparent", border: "none", resize: "none", position: "relative", zIndex: 2, boxSizing: "border-box" }}
        />
        {/* Blank page nudge */}
        {showNudge && currentWords < 20 && (
          <div
            onClick={() => { setTab("chat"); }}
            style={{ position: "absolute", bottom: 18, left: 18, right: 18, textAlign: "center", cursor: "pointer", animation: "fadeIn 0.5s ease", zIndex: 3, pointerEvents: "auto" }}
          >
            <span style={{ fontSize: 12, color: COLORS.muted, fontFamily: mono, background: COLORS.bg, padding: "6px 14px", borderRadius: 16, border: `1px dashed ${COLORS.border}` }}>
              Not sure where to begin? Tap <span style={{ color: COLORS.heading, fontWeight: 700 }}>Ask Lyra</span> and I'll help you start.
            </span>
          </div>
        )}
      </div>

      {/* Style suggestions badge */}
      {sugBadge && suggestions && (
        <div onClick={() => setSugBadge(false)} style={{ position: "absolute", bottom: 120, right: 18, background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 20, padding: "8px 16px", fontSize: 12, color: COLORS.heading, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", animation: "fadeUp 0.3s ease", zIndex: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <FeatherIcon size={14} /> Style suggestions available
        </div>
      )}

      {/* Structural suggestions panel */}
      {suggestions && !sugBadge && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "60%", overflowY: "auto", background: COLORS.card, borderTop: `1.5px solid ${COLORS.border}`, borderRadius: "18px 18px 0 0", padding: "18px", boxShadow: "0 -8px 32px rgba(0,0,0,0.08)", animation: "slideUp 0.3s ease", zIndex: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: COLORS.heading, display: "flex", alignItems: "center", gap: 6 }}><FeatherIcon size={16} color={COLORS.heading} /> Style Suggestions</div>
            <button onClick={() => setSuggestions(null)} style={{ background: "none", border: "none", fontSize: 18, color: COLORS.muted, cursor: "pointer" }}>{"\u00d7"}</button>
          </div>
          {suggestions.map((sug, i) => (
            <div key={i} style={{ ...s.card, marginBottom: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.blue, marginBottom: 4 }}>{sug.technique}</div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10 }}>{sug.description}</div>
              <div style={{ fontSize: 12, padding: "8px 10px", borderRadius: 8, background: "#FFF5F5", color: COLORS.red, marginBottom: 8, lineHeight: 1.5 }}>Your sentence: {sug.original}</div>
              {sug.vocabulary?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.heading, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontFamily: mono }}>Vocabulary to try</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {sug.vocabulary.map((word, j) => (
                      <span key={j} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: "#F0F8FF", color: COLORS.blue, fontWeight: 600, fontFamily: mono }}>{word}</span>
                    ))}
                  </div>
                </div>
              )}
              {sug.template && (
                <div style={{ background: "#F0EDE8", border: `1.5px dashed ${COLORS.accent1}`, borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent1, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, fontFamily: mono }}>Structure</div>
                  <div style={{ fontSize: 12, color: COLORS.heading, lineHeight: 1.6, fontFamily: mono }}>{sug.template}</div>
                </div>
              )}
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10, lineHeight: 1.5 }}>{sug.explanation}</div>
              <button onClick={() => applySuggestion(sug)} style={{ ...s.chip, fontSize: 11, background: COLORS.heading, color: "#fff", borderColor: COLORS.heading, fontWeight: 700 }}>I've rewritten it {"\u2192"}</button>
            </div>
          ))}
        </div>
      )}

      {/* Proofread panel */}
      {(proofread || proofLoading) && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "70%", overflowY: "auto", background: COLORS.card, borderTop: `1.5px solid ${COLORS.border}`, borderRadius: "18px 18px 0 0", padding: "18px", boxShadow: "0 -8px 32px rgba(0,0,0,0.08)", animation: "slideUp 0.3s ease", zIndex: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: COLORS.heading }}>Doing the magic</div>
            <button onClick={() => cancelProofread()} aria-label="Close proofread" style={{ background: "none", border: "none", fontSize: 18, color: COLORS.muted, cursor: "pointer" }}>{"\u00d7"}</button>
          </div>

          {proofLoading ? (
            <div style={{ textAlign: "center", padding: "36px 24px" }}>
              <div style={{ position: "relative", height: 50, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 10, left: "50%", marginLeft: -40, animation: "featherWrite 1.8s ease-in-out infinite" }}>
                  <FeatherIcon size={32} />
                </div>
                <div style={{ position: "absolute", bottom: 6, left: "15%", height: 2, borderRadius: 1, background: COLORS.accent2, animation: "inkTrail 1.8s ease-in-out infinite" }} />
                <div style={{ position: "absolute", bottom: 14, left: "20%", height: 2, borderRadius: 1, background: COLORS.accent2, animation: "inkTrail 1.8s 0.3s ease-in-out infinite" }} />
                <div style={{ position: "absolute", bottom: 22, left: "10%", height: 2, borderRadius: 1, background: COLORS.accent2, animation: "inkTrail 1.8s 0.6s ease-in-out infinite" }} />
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted }}>Doing the magic...</div>
            </div>
          ) : proofread && (
            proofread.error ? (
              <div style={{ textAlign: "center", padding: "28px 20px" }}>
                <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6, marginBottom: 14 }}>{proofread.error}</div>
                <button onClick={runProofread} style={{ ...s.chip, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.heading, cursor: "pointer" }}>{"↻"} Try again</button>
              </div>
            ) : (
            <>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 16, background: COLORS.bg2, borderRadius: 10, padding: 3 }}>
                {[
                  { id: "grammar", label: "Grammar", color: COLORS.red },
                  { id: "style", label: "Style", color: COLORS.amber },
                  { id: "vocabulary", label: "Vocab", color: COLORS.blue },
                ].map(t => (
                  <button key={t.id} onClick={() => setProofTab(t.id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: "none", background: proofTab === t.id ? COLORS.card : "transparent", fontFamily: mono, fontSize: 12, color: proofTab === t.id ? t.color : COLORS.muted, fontWeight: proofTab === t.id ? 700 : 400, cursor: "pointer", boxShadow: proofTab === t.id ? "0 1px 4px rgba(0,0,0,0.06)" : "none" }}>{t.label}</button>
                ))}
              </div>

              {/* Grammar tab */}
              {proofTab === "grammar" && (proofread.grammar?.length ? groupGrammarByRule(proofread.grammar).map((grp, i) => (
                <div key={i} style={{ ...s.card, marginBottom: 10, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.heading }}>{grp.rule}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, background: "#FFF5F5", borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{grp.instances.length} {grp.instances.length === 1 ? "place" : "places"}</div>
                  </div>
                  {(expandedRules.has(i) ? grp.instances : grp.instances.slice(0, INSTANCE_PREVIEW)).map((it, j) => (
                    <div key={j} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, background: "#FFF5F5", color: COLORS.red }}>{it.wrong}</span>
                      <span style={{ fontSize: 12, color: COLORS.muted }}>{"→"}</span>
                      <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, background: "#F0FFF0", color: COLORS.green }}>{it.right}</span>
                    </div>
                  ))}
                  {grp.instances.length > INSTANCE_PREVIEW && (
                    <button onClick={() => toggleRule(i)} style={{ background: "none", border: "none", color: COLORS.heading, fontFamily: mono, fontSize: 11, cursor: "pointer", padding: "2px 0", marginBottom: 4, textDecoration: "underline" }}>
                      {expandedRules.has(i) ? "Show less" : `and ${grp.instances.length - INSTANCE_PREVIEW} more`}
                    </button>
                  )}
                  <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.5, margin: "6px 0 8px" }}>{grp.explanation}</div>
                  {(grp.example_wrong || grp.example_correct) && (
                    <div style={{ background: COLORS.bg2, borderRadius: 8, padding: 10, marginBottom: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Example</div>
                      {grp.example_wrong && <div style={{ fontSize: 11, color: COLORS.red, lineHeight: 1.5, marginBottom: 4 }}>{"\u2717"} {grp.example_wrong}</div>}
                      {grp.example_correct && <div style={{ fontSize: 11, color: COLORS.green, lineHeight: 1.5 }}>{"\u2713"} {grp.example_correct}</div>}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: COLORS.accent2, marginTop: 4 }}>Saved to Grammar Log</div>
                  <button onClick={() => {
                    const fakeEntry = { id: "proof_" + i, rule: grp.rule, phrase: grp.instances[0]?.wrong, correction: grp.instances[0]?.right, explanation: grp.explanation };
                    fetchMiniLesson(fakeEntry);
                  }} style={{ marginTop: 8, width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${COLORS.border}`, background: miniLesson["proof_" + i]?.content ? COLORS.bg3 : COLORS.card, fontFamily: mono, fontSize: 11, cursor: "pointer", color: COLORS.heading, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }}>
                    {miniLesson["proof_" + i]?.loading ? (
                      <><div style={{ animation: "featherWrite 1.8s ease-in-out infinite", display: "inline-block" }}><FeatherIcon size={12} /></div> Loading...</>
                    ) : miniLesson["proof_" + i]?.content ? (
                      "Hide lesson"
                    ) : (
                      <><FeatherIcon size={12} /> Teach me this</>
                    )}
                  </button>
                  {miniLesson["proof_" + i]?.content && !miniLesson["proof_" + i]?.loading && (
                    <MiniLessonCard content={miniLesson["proof_" + i].content} rule={grp.rule} phrase={grp.instances[0]?.wrong} correction={grp.instances[0]?.right} sendChat={sendChat} setTab={setTab} />
                  )}
                </div>
              )) : <div style={{ textAlign: "center", padding: "24px 16px", fontSize: 12, color: COLORS.muted }}>{"✓"} No grammar issues found.</div>)}

              {/* Style tab */}
              {proofTab === "style" && (proofread.style?.length ? proofread.style.map((st, i) => (
                <div key={i} style={{ ...s.card, marginBottom: 10, padding: 12, borderLeft: `3px solid ${COLORS.amber}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.amber, marginBottom: 6 }}>{st.observation}</div>
                  <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>{st.suggestion}</div>
                </div>
              )) : <div style={{ textAlign: "center", padding: "24px 16px", fontSize: 12, color: COLORS.muted }}>{"✓"} No style notes — looks good.</div>)}

              {/* Vocabulary tab */}
              {proofTab === "vocabulary" && (proofread.vocabulary?.length ? proofread.vocabulary.map((v, i) => (
                <div key={i} style={{ ...s.card, marginBottom: 10, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: COLORS.muted, textDecoration: "line-through" }}>{v.weak}</span>
                    <span style={{ fontSize: 12, color: COLORS.muted }}>{"\u2192"}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.blue }}>{v.stronger}</span>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>{v.reason}</div>
                </div>
              )) : <div style={{ textAlign: "center", padding: "24px 16px", fontSize: 12, color: COLORS.muted }}>{"✓"} No vocabulary upgrades suggested.</div>)}
            </>
            )
          )}
        </div>
      )}

      {/* Ask Lyra button */}
      <div style={{ padding: "10px 18px 8px", display: "flex", gap: 10, flexShrink: 0 }}>
        <button onClick={() => { if (draft.trim()) { sendChat(`Here's my current draft:\n\n"${draft.slice(0, 800)}"\n\nWhat should I work on next?`); setTab("chat"); } }} disabled={!draft.trim()} style={{ ...s.btn, flex: 1, fontSize: 13, padding: "11px 16px", background: COLORS.card, color: COLORS.heading, border: `1.5px solid ${COLORS.border}`, opacity: !draft.trim() ? 0.4 : 1 }}>Ask Lyra {"\u2192"}</button>
      </div>
    </div>
  );
}
