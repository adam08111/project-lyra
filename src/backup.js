/**
 * LYRA BACKUP — local safety net against accidental data loss.
 *
 * All of Lyra's student data lives in localStorage (saved skills, writings +
 * their chats, Practice-chat threads, Achievements, progress, grammar log,
 * vocabulary). A stray `localStorage.removeItem`, a cleared site-data, or a
 * buggy write can wipe it with no recourse. This module keeps a single
 * rolling snapshot under `lyra-backup-v1` and silently heals any key that
 * goes MISSING on the next app load.
 *
 * Design rules that make it safe:
 *  - STICKY PER-KEY: a snapshot never downgrades a key from has-content to
 *    empty. If the live key was wiped but the previous backup held data, the
 *    backup keeps the last good value. So a partial wipe can't erase the
 *    backup's record of the wiped key.
 *  - HEAL ONLY ABSENT KEYS: auto-restore touches a key only when it is
 *    ENTIRELY ABSENT from localStorage (the signature of a stray removeItem
 *    or a fresh-wiped origin). A present-but-empty value ("[]") is a
 *    legitimate user state (e.g. they deleted all skills on purpose) and is
 *    never clobbered.
 */

const BACKUP_KEY = "lyra-backup-v1";

// Every localStorage key that holds irreplaceable student data.
export const CRITICAL_KEYS = [
  "lyra-style-skills",        // saved analysed skills
  "lyra-projects",            // writings + their Lyra chats
  "lyra-training-chats",      // Practice-session chat threads
  "lyra-masterclass-reports", // Achievements cards
  "lyra-training-progress",   // per-technique attempts
  "lyra-saved-concepts",      // bookmarked grammar concepts
  "lyra-vocabulary",          // vocabulary arsenal
  "lyra-structures",          // sentence-structure library
  "lyra-skill-deployments",   // skill deployment log
  "lyra-growth-log",          // before/after growth log
  "grammar-log",              // grammar mistakes log
  "lyra-growth-profile",      // continuous growth report — Lyra's running memory of the student
];

const isEmptyVal = (v) => v == null || v === "[]" || v === "{}" || v === "";

/**
 * Write a snapshot of all critical keys to the backup key. Per-key sticky:
 * if a live key is empty/absent but the previous backup had content for it,
 * the previous value is retained so a wipe can't erase the backup.
 * @returns {boolean} true if a snapshot was written
 */
export function snapshotBackup() {
  try {
    let prev = {};
    try { prev = JSON.parse(localStorage.getItem(BACKUP_KEY) || "{}").data || {}; } catch (e) { /* ignore */ }

    const data = {};
    for (const k of CRITICAL_KEYS) {
      const cur = localStorage.getItem(k);
      const prevHasContent = !isEmptyVal(prev[k]);
      if (isEmptyVal(cur) && prevHasContent) {
        data[k] = prev[k];          // keep last good value — never downgrade
      } else if (cur != null) {
        data[k] = cur;              // record current value
      } else if (prev[k] != null) {
        data[k] = prev[k];          // carry forward any prior record
      }
    }
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ ts: new Date().toISOString(), data }));
    return true;
  } catch (e) {
    // The safety net must never fail silently — when quota is hit, the FIRST
    // thing to die is the backup itself, and §17.3 exists because silent data
    // loss already happened once. Console-only by design (no student UI).
    if (e?.name === "QuotaExceededError" || e?.code === 22) {
      console.warn("[lyra-backup] snapshot failed — localStorage quota exceeded; backups are NOT being updated");
    } else {
      console.warn("[lyra-backup] snapshot failed:", e?.name, e?.message);
    }
    return false;
  }
}

/**
 * Heal any critical key that is entirely ABSENT from localStorage, using the
 * last good value from the backup. Does NOT touch present-but-empty keys.
 * Call once at app startup BEFORE any component reads localStorage.
 * @returns {{ restored: string[], ts: string|null }}
 */
export function autoRestoreFromBackup() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return { restored: [], ts: null };
    const parsed = JSON.parse(raw);
    const data = parsed.data || {};
    const restored = [];
    for (const k of CRITICAL_KEYS) {
      if (localStorage.getItem(k) === null && !isEmptyVal(data[k])) {
        localStorage.setItem(k, data[k]);
        restored.push(k);
      }
    }
    if (restored.length) {
      console.info(`[lyra-backup] restored ${restored.length} key(s) from snapshot ${parsed.ts}:`, restored.join(", "));
    }
    return { restored, ts: parsed.ts };
  } catch (e) {
    console.warn("[lyra-backup] auto-restore failed:", e?.name, e?.message);
    return { restored: [], ts: null };
  }
}

/**
 * Inspect the current backup (for UI / diagnostics).
 * @returns {{ ts: string, keys: string[] }|null}
 */
export function getBackupInfo() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const data = parsed.data || {};
    return { ts: parsed.ts, keys: Object.keys(data).filter(k => !isEmptyVal(data[k])) };
  } catch (e) {
    console.warn("[lyra-backup] backup info unreadable:", e?.name, e?.message);
    return null;
  }
}
