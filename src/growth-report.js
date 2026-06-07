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

export const GROWTH_PROFILE_KEY = "lyra-growth-profile";

// Don't generate a report until there's enough signal — below this the Report
// tab shows an encouraging locked state instead of a thin, unfair assessment.
export const MIN_PRACTICES_TO_UNLOCK = 3;

// Auto-regenerate after this many new practices (one practice doesn't change an
// assessment; a few give a real delta).
export const REGEN_EVERY_N_PRACTICES = 3;

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
