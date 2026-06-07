import { useState, useEffect } from "react";
import { COLORS } from "../constants.js";
import { sharedStyles as s } from "../styles.js";
import { FeatherIcon } from "./Icons.jsx";
import {
  loadProfile,
  regenerateGrowthProfile,
  dedupedPracticeCount,
  MIN_PRACTICES_TO_UNLOCK,
  REGEN_EVERY_N_PRACTICES,
} from "../growth-report.js";

const mono = "'Courier Prime', monospace";

// Minimal markdown for the section prose: **bold** + preserved line breaks.
function renderProse(text) {
  if (!text) return null;
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const b = part.match(/^\*\*([^*]+)\*\*$/);
    return b ? <strong key={i}>{b[1]}</strong> : <span key={i}>{part}</span>;
  });
}

const TRAJ = { rising: "↗", steady: "→", early: "·" };

/**
 * The Continuous Growth Report — Lyra's running, honest assessment of the
 * student (the Report tab). Reads the persisted `lyra-growth-profile`, renders
 * it bilingually, and regenerates (one Gemini call) on first unlock, when there
 * are enough new practices, or on an explicit refresh.
 */
export default function GrowthReport({ trackCall }) {
  const [profile, setProfile] = useState(() => loadProfile());
  const [lang, setLang] = useState("en"); // "en" | "zh"
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState({});

  const practiceCount = dedupedPracticeCount();
  const pending = Number(localStorage.getItem("lyra-growth-pending")) || 0;
  const pick = (en, zh) => (lang === "zh" ? zh || en : en || zh) || "";

  const regen = async (force = false) => {
    if (loading) return;
    setLoading(true);
    setErr("");
    try {
      const res = await regenerateGrowthProfile(trackCall, { force });
      if (res && res.profile) setProfile(res.profile);
      else if (res && res.error) setErr(pick("Couldn't build your report — try again.", "未能建立報告，請再試一次。"));
    } catch (e) {
      setErr(pick("Couldn't build your report — try again.", "未能建立報告，請再試一次。"));
    }
    setLoading(false);
  };

  // First open: generate if unlocked & no profile yet, or refresh if enough new practices.
  useEffect(() => {
    if (!profile && practiceCount >= MIN_PRACTICES_TO_UNLOCK) regen();
    else if (profile && pending >= REGEN_EVERY_N_PRACTICES) regen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = (bg, border) => ({
    background: bg,
    border: `1px solid ${COLORS.border}`,
    borderLeft: `3px solid ${border}`,
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 10,
    fontFamily: mono,
  });
  const sectionTitle = { fontSize: 11, fontWeight: 700, color: COLORS.heading, textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 6, fontFamily: mono };
  const prose = { fontSize: 12.5, color: COLORS.text, lineHeight: 1.65, fontFamily: mono, whiteSpace: "pre-wrap" };

  // ── Locked / cold start ──
  if (!profile && !loading) {
    if (practiceCount < MIN_PRACTICES_TO_UNLOCK) {
      return (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <FeatherIcon size={28} color={COLORS.accent2} />
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.heading, marginTop: 14, fontFamily: mono }}>
            {pick("Your growth report unlocks soon", "你的成長報告即將解鎖")}
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8, lineHeight: 1.6, fontFamily: mono }}>
            {pick(
              `Practise a few more times — ${practiceCount}/${MIN_PRACTICES_TO_UNLOCK} so far — and Lyra will write your first report. Keep going!`,
              `再多練習幾次（目前 ${practiceCount}/${MIN_PRACTICES_TO_UNLOCK}），Lyra 就會寫出你的第一份報告。繼續加油！`
            )}
          </div>
        </div>
      );
    }
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <FeatherIcon size={28} color={COLORS.accent2} />
        <div style={{ fontSize: 12, color: COLORS.muted, margin: "12px 0", fontFamily: mono }}>
          {pick("Ready for your first growth report.", "準備好你的第一份成長報告。")}
        </div>
        <button onClick={() => regen()} style={{ ...s.btn }}>{pick("Generate my report", "建立我的報告")}</button>
        {err && <div style={{ color: COLORS.red, fontSize: 11, marginTop: 10, fontFamily: mono }}>{err}</div>}
      </div>
    );
  }

  if (loading && !profile) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <div style={{ animation: "featherWrite 1.8s ease-in-out infinite", display: "inline-block", marginBottom: 16 }}>
          <FeatherIcon size={32} />
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted, fontFamily: mono, lineHeight: 1.5 }}>
          {pick("Lyra is reading back through your writing…", "Lyra 正在回顧你的寫作……")}
        </div>
      </div>
    );
  }

  const p = profile || {};
  const lvl = p.level || {};

  return (
    <div>
      {/* lang toggle + refresh */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", background: COLORS.bg3, borderRadius: 14, padding: 2 }}>
          {["en", "zh"].map((l) => (
            <button key={l} onClick={() => setLang(l)} style={{ padding: "4px 12px", borderRadius: 12, border: "none", background: lang === l ? COLORS.card : "transparent", fontFamily: mono, fontSize: 11, fontWeight: lang === l ? 700 : 400, color: lang === l ? COLORS.heading : COLORS.muted, cursor: "pointer" }}>
              {l === "en" ? "EN" : "繁中"}
            </button>
          ))}
        </div>
        <button
          onClick={() => regen(true)}
          disabled={loading || pending === 0}
          title={pending === 0 ? pick("No new practices since this report", "自上次報告後未有新練習") : pick(`${pending} new practice(s) since this report`, `自上次報告後有 ${pending} 次新練習`)}
          style={{ fontSize: 11, fontFamily: mono, padding: "5px 12px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.card, color: loading || pending === 0 ? COLORS.accent2 : COLORS.heading, cursor: loading || pending === 0 ? "default" : "pointer" }}
        >
          {loading ? pick("Updating…", "更新中……") : pick("↻ Refresh", "↻ 更新")}
        </button>
      </div>

      {/* header — named level + trajectory */}
      <div style={{ ...card(COLORS.bg2, COLORS.accent1), textAlign: "center", padding: 18 }}>
        <FeatherIcon size={22} />
        <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.heading, marginTop: 6, fontFamily: mono }}>
          {pick(lvl.name, lvl.name_zh)} <span style={{ color: COLORS.green, fontSize: 15 }}>{TRAJ[lvl.trajectory] || ""}</span>
        </div>
        {(lvl.summary || lvl.summary_zh) && (
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 5, lineHeight: 1.5 }}>{pick(lvl.summary, lvl.summary_zh)}</div>
        )}
      </div>

      {/* strengths — green */}
      {p.sections?.strengths && (
        <>
          <div style={sectionTitle}>{pick("What you're doing well", "你做得好的地方")}</div>
          <div style={card("#F0F6F1", COLORS.green)}>
            <div style={prose}>{renderProse(pick(p.sections.strengths.en, p.sections.strengths.zh))}</div>
          </div>
        </>
      )}

      {/* growth — gold/amber, celebratory */}
      {(p.sections?.growth || (p.growthItems && p.growthItems.length > 0)) && (
        <>
          <div style={sectionTitle}>{pick("Your growth since last time", "你的進步")}</div>
          <div style={card("#FBF6E6", COLORS.amber)}>
            {p.sections?.growth && <div style={{ ...prose, marginBottom: p.growthItems?.length ? 8 : 0 }}>{renderProse(pick(p.sections.growth.en, p.sections.growth.zh))}</div>}
            {(p.growthItems || []).map((g, i) => (
              <div key={i} style={{ fontSize: 12, color: COLORS.heading, marginTop: 4, display: "flex", gap: 6, alignItems: "baseline" }}>
                <span style={{ color: COLORS.green }}>{g.type === "weakness_resolved" ? "🎉" : "✓"}</span>
                <span style={{ flex: 1 }}>{pick(g.text, g.text_zh)}</span>
                {g.isNew && <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: COLORS.green, borderRadius: 6, padding: "1px 5px" }}>NEW</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* what we're working on — amber (never red), with visible occurrence memory */}
      {(p.sections?.workingOn || (p.weaknesses && p.weaknesses.some((w) => w.status !== "resolved"))) && (
        <>
          <div style={sectionTitle}>{pick("What we're working on", "正在努力的地方")}</div>
          {p.sections?.workingOn && (
            <div style={card("#FFF8EE", COLORS.amber)}>
              <div style={prose}>{renderProse(pick(p.sections.workingOn.en, p.sections.workingOn.zh))}</div>
            </div>
          )}
          {(p.weaknesses || [])
            .filter((w) => w.status !== "resolved")
            .map((w, i) => {
              const open = expanded[w.id || i];
              const trendLabel =
                w.trend === "improving" ? pick("improving ↓", "進步中 ↓") : w.trend === "worsening" ? pick("watch ↑", "留意 ↑") : pick("steady →", "持平 →");
              return (
                <div key={w.id || i} style={card(COLORS.card, COLORS.amber)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, cursor: w.evidence?.length ? "pointer" : "default" }} onClick={() => w.evidence?.length && setExpanded((e) => ({ ...e, [w.id || i]: !open }))}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.heading }}>{pick(w.label, w.label_zh)}</div>
                    <div style={{ fontSize: 10, color: COLORS.muted, whiteSpace: "nowrap" }}>{trendLabel}</div>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 3 }}>
                    {pick(`Noticed ${w.occurrences || 0} time${w.occurrences === 1 ? "" : "s"}`, `留意到 ${w.occurrences || 0} 次`)}
                    {w.evidence?.length ? <span> · {open ? pick("hide examples", "收起") : pick("see examples", "看例子")}</span> : null}
                  </div>
                  {w.prescription && (pick(w.prescription.en, w.prescription.zh)) && (
                    <div style={{ fontSize: 12, color: COLORS.text, marginTop: 6, lineHeight: 1.6, background: COLORS.bg2, borderRadius: 8, padding: "8px 10px" }}>
                      💡 {pick(w.prescription.en, w.prescription.zh)}
                    </div>
                  )}
                  {open &&
                    (w.evidence || []).map((ev, j) => (
                      <div key={j} style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${COLORS.border}`, fontSize: 11.5, lineHeight: 1.5 }}>
                        {ev.before && <div style={{ color: COLORS.muted, fontStyle: "italic" }}>{pick("Before:", "之前：")} {ev.before}</div>}
                        {ev.after && <div style={{ color: COLORS.heading, marginTop: 2 }}>{pick("After:", "之後：")} {ev.after}</div>}
                      </div>
                    ))}
                </div>
              );
            })}
        </>
      )}

      {/* focus — calm blue */}
      {p.sections?.focus && (
        <>
          <div style={sectionTitle}>{pick("Your focus for next time", "下次的重點")}</div>
          <div style={card("#EEF4F8", COLORS.blue)}>
            <div style={prose}>{renderProse(pick(p.sections.focus.en, p.sections.focus.zh))}</div>
          </div>
        </>
      )}

      {/* by the numbers — subordinate */}
      {p.stats && (
        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 16, fontSize: 10.5, color: COLORS.muted, fontFamily: mono }}>
          <span>{p.stats.techniquesPractised || 0} {pick("techniques", "技巧")}</span>
          <span>·</span>
          <span>{p.stats.totalWords || 0} {pick("words", "字")}</span>
          {p.stats.currentStreak ? (
            <>
              <span>·</span>
              <span>{pick(`${p.stats.currentStreak}-practice streak`, `連續 ${p.stats.currentStreak} 次`)}</span>
            </>
          ) : null}
        </div>
      )}

      {err && <div style={{ color: COLORS.red, fontSize: 11, marginTop: 10, textAlign: "center", fontFamily: mono }}>{err}</div>}
    </div>
  );
}
