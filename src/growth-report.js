/**
 * GROWTH REPORT — storage + delta gathering for Lyra's Continuous Growth Report.
 *
 * The report is an INCREMENTAL student profile (key `lyra-growth-profile`):
 * Lyra's persisted memory of the student. Each regeneration loads the profile,
 * gathers only the NEW learning data since `lastRegenAt`, makes one Gemini call
 * that updates the profile, and persists it. We never re-summarise full history
 * (kills continuity + cost). See report-utils.js for the dedup keystone and
 * src/report-card-brain.js for the prompt; the one-call flow lands in GR-4.
 */

import { groupReports, buildDelta, countDedupedPractices } from "./report-utils.js";
import { callAI } from "./api.js";
import { getRouteConfig } from "./ai-router.js";
import { REPORT_CARD_BRAIN } from "./report-card-brain.js";
import { anonymiseSkillsForAI, restoreAuthorNames } from "./utils.js";

export const GROWTH_PROFILE_KEY = "lyra-growth-profile";

// Don't generate a report until there's enough signal — below this the Report
// tab shows an encouraging locked state instead of a thin, unfair assessment.
export const MIN_PRACTICES_TO_UNLOCK = 3;

// Auto-regenerate after this many new practices (one practice doesn't change an
// assessment; a few give a real delta).
export const REGEN_EVERY_N_PRACTICES = 3;

// MILESTONE-FORCE (spec §5) — when the last report flagged that the student is on
// the verge of a milestone (a weakness the AI marked "improving", or a "rising"
// trajectory toward a new level), don't make them wait the full cadence: a single
// new practice is enough to regenerate, so a freshly-beaten weakness or a level-up
// is confirmed and celebrated the moment it happens. The trigger is the AI's own
// forward-looking flags — we never guess the milestone locally, we just check more
// eagerly. Cost stays bounded: "improving"/"rising" are transient (they flip to
// resolved/steady once the student lands or plateaus), and `pending` only grows on
// real practice, so this never regenerates with zero new data.
export function milestoneImminent(profile) {
  if (!profile) return false;
  const improving = (profile.weaknesses || []).some((w) => w && w.status === "improving");
  const rising = profile.level?.trajectory === "rising";
  return improving || rising;
}

// New practices needed before an auto-regen: 1 when a milestone is imminent, else
// the normal cadence.
export function effectiveRegenThreshold(profile) {
  return milestoneImminent(profile) ? 1 : REGEN_EVERY_N_PRACTICES;
}

const readJSON = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch (e) {
    return [];
  }
};

export function loadProfile() {
  try {
    const raw = localStorage.getItem(GROWTH_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(GROWTH_PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch (e) {
    return false;
  }
}

/** All localStorage learning sources the growth report draws on. */
export function gatherStores() {
  return {
    reports: readJSON("lyra-masterclass-reports"),
    grammarLog: readJSON("grammar-log"),
    structures: readJSON("lyra-structures"),
    vocabulary: readJSON("lyra-vocabulary"),
  };
}

/** Distinct practice moments (cold-start gate uses this, not raw report count). */
export function dedupedPracticeCount() {
  return countDedupedPractices(gatherStores().reports);
}

/** Build the regeneration delta from current localStorage, since the last regen. */
export function buildCurrentDelta(profile) {
  const { reports, grammarLog, structures, vocabulary } = gatherStores();
  return buildDelta({
    reportClusters: groupReports(reports),
    grammarLog,
    structures,
    vocabulary,
    since: profile?.lastRegenAt || 0,
  });
}

/** Push a capped history snapshot (anchors "growth since last time"). */
export function pushHistorySnapshot(profile) {
  const snap = {
    date: profile.lastRegenAt || new Date().toISOString(),
    levelName: profile.level?.name || "",
    bandEstimate: profile.level?.bandEstimate || "",
    activeWeaknessCount: (profile.weaknesses || []).filter((w) => w.status === "active").length,
  };
  profile.history = [...(profile.history || []), snap].slice(-12);
  return profile;
}

// Defensive parse: the model is told "no fences", but tolerate ```json fences
// or a stray preamble by extracting the outermost { ... } object.
function parseProfileJSON(s) {
  let t = (s || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

// Flag growthItems that weren't in the previous profile, so the UI can badge
// them "NEW" (a freshly resolved weakness is the biggest motivator).
function markNewGrowthItems(prev, updated) {
  const prevTexts = new Set((prev?.growthItems || []).map((g) => (g.text || "").trim()));
  (updated.growthItems || []).forEach((g) => {
    g.isNew = !prevTexts.has((g.text || "").trim());
  });
}

/**
 * Diff the pre-regen profile against the just-produced one to surface the two
 * milestones §5 cares about: a level change, and any weakness that was being
 * worked on and is now resolved/graduated. Guarded so a cold start (no prior
 * level or weakness to compare) never reports a phantom milestone.
 * @returns {{ leveledUp, levelFrom, levelTo, levelTo_zh, resolved: {id,label,label_zh}[] }}
 */
export function computeMilestones(prev, updated) {
  const out = { leveledUp: false, levelFrom: "", levelTo: "", levelTo_zh: "", resolved: [] };
  const prevLevel = prev?.level?.name || "";
  const newLevel = updated?.level?.name || "";
  if (prevLevel && newLevel && prevLevel !== newLevel) {
    out.leveledUp = true;
    out.levelFrom = prevLevel;
    out.levelTo = newLevel;
    out.levelTo_zh = updated.level?.name_zh || "";
  }

  // A weakness counts as just-resolved only if it was actively tracked before and
  // is now resolved or graduated — so a brand-new "resolved" the AI invents on a
  // cold start can't masquerade as a hard-won win.
  const wasActive = new Map(
    (prev?.weaknesses || [])
      .filter((w) => w && w.id && w.status && w.status !== "resolved")
      .map((w) => [w.id, w])
  );
  const nowResolved = new Set([
    ...(updated?.graduated || []).map((g) => g && g.id).filter(Boolean),
    ...(updated?.weaknesses || []).filter((w) => w && w.status === "resolved").map((w) => w.id),
  ]);
  for (const [id, w] of wasActive) {
    if (nowResolved.has(id)) {
      const grad = (updated?.graduated || []).find((g) => g && g.id === id);
      out.resolved.push({ id, label: grad?.label || w.label || "", label_zh: grad?.label_zh || w.label_zh || "" });
    }
  }
  return out;
}

export const hasMilestone = (m) => !!m && (m.leveledUp || (Array.isArray(m.resolved) && m.resolved.length > 0));

/**
 * Regenerate the growth profile: load → build delta → ONE Gemini call → save.
 * Incremental (current profile + small delta), never full re-synthesis.
 *
 * @param {Function} trackCall - the app's API-call counter
 * @param {{ force?: boolean }} opts - force bypasses the cold-start gate
 * @returns {Promise<{profile}|{locked, practiceCount, needed}|{error, raw}>}
 */
export async function regenerateGrowthProfile(trackCall, { force = false } = {}) {
  const { reports } = gatherStores();
  const practiceCount = countDedupedPractices(reports);
  if (!force && practiceCount < MIN_PRACTICES_TO_UNLOCK) {
    return { locked: true, practiceCount, needed: MIN_PRACTICES_TO_UNLOCK };
  }

  const profile = loadProfile() || {};
  const delta = buildCurrentDelta(profile);

  // Anti-bias: scrub saved-author names from the input, restore them in the
  // output (same discipline as the coaching chat).
  let savedSkills = [];
  try {
    savedSkills = JSON.parse(localStorage.getItem("lyra-style-skills") || "[]");
  } catch (e) {
    /* ignore */
  }
  const { mapping } = anonymiseSkillsForAI(savedSkills);
  let input = JSON.stringify({ CURRENT_PROFILE: profile, DELTA: delta });
  for (const { writerLabel, realName } of mapping) {
    if (realName && realName.length > 2) {
      const safe = realName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      input = input.replace(new RegExp(safe, "gi"), writerLabel);
    }
  }

  const route = getRouteConfig("growth_report");
  if (trackCall) trackCall();
  let raw = await callAI(REPORT_CARD_BRAIN, input, false, 4000, route.thinkingBudget, undefined, undefined, route.model);
  if (raw && typeof raw === "object" && typeof raw.text === "string") raw = raw.text;
  raw = restoreAuthorNames(raw, mapping);

  let updated;
  try {
    updated = parseProfileJSON(raw);
  } catch (e) {
    return { error: "parse", raw: typeof raw === "string" ? raw.slice(0, 500) : "" };
  }

  // App-managed bookkeeping (don't trust the model for these).
  updated.version = 1;
  updated.createdAt = profile.createdAt || updated.createdAt || new Date().toISOString();
  updated.lastRegenAt = new Date().toISOString();
  updated.practicesSinceRegen = 0;
  updated.totalPractices = practiceCount;
  updated.history = profile.history || []; // history is app-managed, not AI-managed
  markNewGrowthItems(profile, updated);
  pushHistorySnapshot(updated);
  saveProfile(updated);
  try { localStorage.setItem("lyra-growth-pending", "0"); } catch (e) { /* silent */ }
  return { profile: updated, milestones: computeMilestones(profile, updated) };
}

