#!/usr/bin/env node
/**
 * seed-synthetic-class.mjs — §106 operator tool. Seeds ONE synthetic demo class for the
 * teacher dashboard (CIP demo artifact). SYNTHETIC DATA ONLY — never real minors' data.
 *
 * NEVER bundled, NEVER imported by the app. Reads secrets from LOCAL ENV ONLY:
 *   SUPABASE_URL                 (or VITE_SUPABASE_URL)   — the project URL
 *   SUPABASE_SERVICE_ROLE_KEY    — the admin key. NEVER commit it; .env is gitignored.
 * Refuses to run unless LYRA_SEED_CONFIRM=SYNTHETIC (a deliberate two-key guard so this
 * can never fire by accident against a real project).
 *
 * Optional:
 *   LYRA_TEACHER_PASSWORD   — set the demo teacher's password (else a random one is
 *                             generated and printed once). Re-runs RESET it so the
 *                             printed password always works.
 *
 * Idempotent by name-keys: re-running finds-or-creates and upserts, so it converges to
 * the same class without duplicating rows. Apply migration 0005 FIRST.
 *
 * Run (PowerShell):
 *   $env:SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="..."; $env:LYRA_SEED_CONFIRM="SYNTHETIC"
 *   node scripts/seed-synthetic-class.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

// ── guardrails ────────────────────────────────────────────────────────────────
if (process.env.LYRA_SEED_CONFIRM !== "SYNTHETIC") {
  console.error("Refusing to run: set LYRA_SEED_CONFIRM=SYNTHETIC to confirm this seeds SYNTHETIC demo data.");
  process.exit(1);
}
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env: need SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (local env only).");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── fixed synthetic identities (name-keys drive idempotency) ──────────────────
const SCHOOL_NAME = "Lyra Demo Secondary School";
const TEACHER_EMAIL = "teacher.demo@lyra.local";
const TEACHER_NAME = "Ms Demo Teacher";
const CLASS_NAME = "Demo Class 3B";
const STUDENTS = [
  "Chan Ka Yan", "Wong Ho Ming", "Lee Sze Wing", "Cheung Tsz Kiu",
  "Ng Wai Lam", "Lam Ka Ho", "Tsang Mei Yee", "Ho Chun Kit",
];
// A spread of rules so student_rule_frequency has a real, varied shape to demo.
const RULES = [
  "Subject-Verb Agreement", "Tense", "Articles", "Prepositions",
  "Punctuation", "Plural / Singular", "Word Order", "Spelling",
];
const OTHER_TYPES = ["skill_deployed", "structure", "vocabulary"];

function genPassword() {
  return "Demo-" + randomBytes(6).toString("hex"); // synthetic; printed once
}
function daysAgoISO(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

async function findOrCreateAuthUser(email, password) {
  // Small demo → one page of users suffices to find an existing match by email.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    if (password) await admin.auth.admin.updateUserById(existing.id, { password });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  return data.user.id;
}

async function findOrCreateRow(table, matchCols, row) {
  let q = admin.from(table).select("*");
  for (const [k, v] of Object.entries(matchCols)) q = q.eq(k, v);
  const { data: found, error: selErr } = await q.limit(1);
  if (selErr) throw new Error(`select ${table} failed: ${selErr.message}`);
  if (found && found.length) return found[0];
  const { data: ins, error: insErr } = await admin.from(table).insert(row).select("*").limit(1);
  if (insErr) throw new Error(`insert ${table} failed: ${insErr.message}`);
  return ins[0];
}

function makeGrowthProfile(name, rule, i) {
  // Report-card-brain shaped (report-card-brain.js). bandEstimate is the teacher-only field.
  return {
    version: 1,
    studentName: name,
    lastRegenAt: daysAgoISO(1),
    level: {
      name: "Developing Writer", name_zh: "發展中的作者",
      trajectory: i % 3 === 0 ? "rising" : "steady",
      bandEstimate: `Band ${3 + (i % 3)}`,
      summary: "Building control over sentence-level accuracy; ideas are coming through more clearly.",
      summary_zh: "正在鞏固句子層面的準確度，想法的表達也越來越清晰。",
    },
    strengths: [{
      id: "vivid_openings", label: "Vivid openings", label_zh: "生動的開頭",
      evidence: [{ text: "The city never sleeps, and neither did she.", date: daysAgoISO(4), practiceId: `p-${i}-1` }],
      firstNoted: daysAgoISO(20), timesObserved: 3,
    }],
    weaknesses: [{
      id: rule.toLowerCase().replace(/[^a-z]+/g, "_"),
      label: rule, label_zh: rule,
      category: "grammar",
      firstSeen: daysAgoISO(20), lastSeen: daysAgoISO(2),
      occurrences: 5 + (i % 4), recentOccurrences: 2, distinctForms: ["he go", "she don't"],
      practicesSinceLastSeen: 1, status: "active", trend: "improving",
      evidence: [{ before: "he go to school", after: "he goes to school", date: daysAgoISO(2), practiceId: `p-${i}-2` }],
      prescription: { en: "Check the verb agrees with its subject before you move on.", zh: "下筆前先檢查動詞與主語是否一致。" },
    }],
    graduated: [],
    sections: {
      level:     { en: "You're a developing writer with a rising trajectory.", zh: "你是一位穩步進步的發展中作者。" },
      strengths: { en: "Your openings pull the reader in.", zh: "你的開頭很能吸引讀者。" },
      growth:    { en: "Fewer agreement slips than last month.", zh: "主謂一致的失誤比上月少了。" },
      workingOn: { en: `We're working on ${rule.toLowerCase()}.`, zh: "我們正在練習這個語法點。" },
      focus:     { en: "One habit: check the verb before moving on.", zh: "一個習慣：先檢查動詞再繼續。" },
    },
    growthItems: [{ text: "Agreement slips down from 8 to 3.", text_zh: "主謂一致失誤由 8 次減至 3 次。", type: "weakness_improved" }],
    stats: { totalWords: 1200 + i * 130, techniquesPractised: 4 + (i % 3), currentStreak: 1 + (i % 4) },
  };
}

async function main() {
  console.log("Seeding synthetic demo class into", SUPABASE_URL);

  const school = await findOrCreateRow("schools", { name: SCHOOL_NAME }, { name: SCHOOL_NAME });

  const teacherPassword = process.env.LYRA_TEACHER_PASSWORD || genPassword();
  const teacherAuthId = await findOrCreateAuthUser(TEACHER_EMAIL, teacherPassword);
  const teacher = await findOrCreateRow(
    "teachers", { auth_user_id: teacherAuthId },
    { auth_user_id: teacherAuthId, display_name: TEACHER_NAME, school_id: school.id },
  );

  const klass = await findOrCreateRow(
    "classes", { teacher_id: teacher.id, name: CLASS_NAME },
    { teacher_id: teacher.id, school_id: school.id, name: CLASS_NAME, class_code: "DEMO-CLASS-1" }, // D-L7: stable demo code
  );

  for (let i = 0; i < STUDENTS.length; i++) {
    const name = STUDENTS[i];
    const email = `student${i + 1}.demo@lyra.local`;
    const authId = await findOrCreateAuthUser(email, genPassword()); // students never sign in; random pw
    const student = await findOrCreateRow("students", { auth_user_id: authId }, { auth_user_id: authId });

    await findOrCreateRow(
      "enrolments", { class_id: klass.id, student_id: student.id },
      { class_id: klass.id, student_id: student.id, display_name: name },
    );

    // Grammar events across a spread of rules + dates → a real rule-frequency shape.
    const events = [];
    const n = 3 + (i % 4);
    for (let j = 0; j < n; j++) {
      const rule = RULES[(i + j) % RULES.length];
      events.push({
        student_id: student.id, type: "grammar", content_key: `${rule}#${j}`,
        rule, technique: null, topic: "My favourite hobby",
        ts: daysAgoISO(2 + j * 3),
        payload: { phrase: "he go", correction: "he goes", rule, explanation: "Third-person singular takes -s." },
      });
    }
    // A few non-grammar events so per-type activity counts are non-trivial.
    for (let k = 0; k < OTHER_TYPES.length; k++) {
      const type = OTHER_TYPES[k];
      events.push({
        student_id: student.id, type, content_key: `${type}#0`,
        rule: null, technique: type === "skill_deployed" ? "Start with a Shock" : null, topic: "My favourite hobby",
        ts: daysAgoISO(1 + k), payload: { note: "synthetic" },
      });
    }
    const { error: evErr } = await admin
      .from("learning_events")
      .upsert(events, { onConflict: "student_id,type,content_key", ignoreDuplicates: true });
    if (evErr) throw new Error(`insert learning_events for ${name} failed: ${evErr.message}`);

    const profile = makeGrowthProfile(name, RULES[i % RULES.length], i);
    const { error: gpErr } = await admin
      .from("growth_profiles")
      .upsert({ student_id: student.id, profile, last_regen_at: daysAgoISO(1) }, { onConflict: "student_id" });
    if (gpErr) throw new Error(`upsert growth_profile for ${name} failed: ${gpErr.message}`);

    console.log(`  ✓ ${name} — ${n} grammar events + profile`);
  }

  console.log("\nDone. Teacher sign-in for /teacher.html:");
  console.log(`  email:    ${TEACHER_EMAIL}`);
  console.log(`  password: ${teacherPassword}`);
  console.log("(Printed once. Re-run with LYRA_TEACHER_PASSWORD=... to set a fixed password.)");
}

main().catch((e) => { console.error("\nSeed failed:", e.message); process.exit(1); });
