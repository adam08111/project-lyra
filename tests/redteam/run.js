// §103 red-team RUNNER. Explicitly-invoked only (`npm run redteam`) — NEVER wired into
// vitest/CI (real API calls, real tokens). All inputs are SYNTHETIC attack fixtures; no
// real student/learning data is ever touched or logged.
//
//   npm run redteam -- --dry-run     print every assembled attack prompt, NO API calls
//   npm run redteam                  live run: call the proxy serially, judge, summarize
//   npm run redteam -- --class=P     restrict to one class (A|B|C|E|P)
//   npm run redteam -- --only=B1-repeat-verbatim   run a single case by id
//
// Env: REDTEAM_PROXY_URL (default http://127.0.0.1:3001/api/gemini), REDTEAM_PACE_MS
// (default 2500 — spacing between calls to respect the dev proxy's 30/min limiter).

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import A from "./attacks/a-pedagogical.js";
import B from "./attacks/b-exfil.js";
import C from "./attacks/c-injection.js";
import E from "./attacks/e-minors.js";
import P from "./attacks/p-political.js";
import { buildCall } from "./routes.js";
import { proxyCall, PROXY_URL } from "./proxy.js";
import { judgeExfil, judgeLLM } from "./judge.js";
import { buildResultRecord } from "./record.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALL = [...A, ...B, ...C, ...E, ...P];

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const classArg = (args.find((a) => a.startsWith("--class=")) || "").split("=")[1];
const onlyArg = (args.find((a) => a.startsWith("--only=")) || "").split("=")[1];
const PACE_MS = Number(process.env.REDTEAM_PACE_MS) || 2500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const trunc = (s, n = 300) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

let cases = ALL;
if (classArg) cases = cases.filter((c) => c.class.toUpperCase() === classArg.toUpperCase());
if (onlyArg) cases = cases.filter((c) => c.id === onlyArg);

console.log(`\n🛡️  Lyra red-team harness (§103) — ${cases.length} case(s)${classArg ? ` [class ${classArg}]` : ""}${onlyArg ? ` [only ${onlyArg}]` : ""}`);
console.log(`    All inputs are SYNTHETIC attack fixtures. No real student data is used.`);

if (DRY) {
  console.log(`    MODE: --dry-run (assembled prompts only, no API calls)\n`);
  for (const c of cases) {
    const call = buildCall(c.route, c.input || {});
    console.log("─".repeat(78));
    console.log(`[${c.id}]  class ${c.class}  route ${c.route}  judge:${c.judge}${c.lang ? `  lang:${c.lang}` : ""}${c.humanReview ? "  HUMAN-REVIEW" : ""}`);
    console.log(`  attack: ${c.desc}`);
    console.log(`  model=${call.model} thinkingBudget=${call.thinkingBudget} maxTokens=${call.maxTokens}${call.image ? " +image" : c.requiresImage ? "  [image: NONE — needs fixture, skipped live]" : ""}`);
    console.log(`  system[0..300]: ${trunc(call.system, 300)}`);
    console.log(`  system[len]:    ${call.system.length} chars`);
    console.log(`  message[0..300]: ${trunc(call.message, 300) || "(empty)"}`);
  }
  console.log("─".repeat(78));
  console.log(`\nDry-run complete: ${cases.length} attack prompt(s) assembled via the REAL builders. No tokens spent.\n`);
  process.exit(0);
}

// ── Live run ──
console.log(`    MODE: LIVE  proxy=${PROXY_URL}  pace=${PACE_MS}ms/call\n`);
const results = [];
const pace = () => sleep(PACE_MS);

for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  const call = buildCall(c.route, c.input || {});
  const tag = `[${i + 1}/${cases.length}] ${c.id} (${c.class}/${c.route})`;

  if (c.requiresImage && !call.image) {
    console.log(`${tag}  ⏭️  SKIPPED — needs an image fixture (see README); dry-run shows the assembled call.`);
    results.push({ id: c.id, class: c.class, route: c.route, verdict: "SKIPPED", humanReview: !!c.humanReview, reason: "no image fixture" });
    continue;
  }

  await pace();
  const res = await proxyCall({ system: call.system, message: call.message, model: call.model, thinkingBudget: call.thinkingBudget, maxTokens: call.maxTokens, image: call.image, studentId: "redteam-harness" });
  const output = res.text || "";

  // Secondary (free) exfil check on EVERY reply, whatever the class.
  const exfil = judgeExfil(c.route, output);

  let judgement;
  if (!res.ok) {
    judgement = { verdict: "ERROR", method: "proxy", reason: `proxy error: ${res.error || res.status}` };
  } else if (c.judge === "exfil") {
    judgement = exfil;
  } else {
    judgement = await judgeLLM(c, output, { pace });
  }

  // Class E is advisory-only: never a clean auto-pass on a model judge.
  const humanReview = !!c.humanReview;
  const displayVerdict = humanReview ? `${judgement.verdict}*` : judgement.verdict;

  const icon = judgement.verdict === "PASS" ? "✅" : judgement.verdict === "FAIL" ? "❌" : judgement.verdict === "ERROR" ? "💥" : "❓";
  console.log(`${tag}  ${icon} ${displayVerdict}  (${judgement.method})  ${judgement.reason}`);
  if (exfil.hits.length && c.judge !== "exfil") console.log(`      ⚠️  secondary exfil hit: ${exfil.hits.length} signature(s)`);

  // §116: store the FULL reply (no 400-char slice) + the attack side, so class-E cases are a
  // readable transcript for the required human review — the §110.1 fix. See record.js.
  results.push(buildResultRecord({ caseObj: c, call, output, judgement, exfil, res }));
}

// ── Summary ──
const CLASSES = ["A", "B", "C", "E", "P"];
console.log(`\n${"═".repeat(78)}\nSUMMARY (per class)`);
for (const cls of CLASSES) {
  const rows = results.filter((r) => r.class === cls);
  if (!rows.length) continue;
  const n = (v) => rows.filter((r) => r.verdict === v).length;
  const hr = rows.some((r) => r.humanReview) ? "  (advisory — HUMAN REVIEW required)" : "";
  console.log(`  Class ${cls}: ${rows.length} case(s) → PASS ${n("PASS")}, FAIL ${n("FAIL")}, UNCLEAR ${n("UNCLEAR")}, ERROR ${n("ERROR")}, SKIPPED ${n("SKIPPED")}${hr}`);
  for (const r of rows.filter((r) => r.verdict === "FAIL")) console.log(`      ❌ ${r.id}: ${r.reason}`);
}
const fails = results.filter((r) => r.verdict === "FAIL" && !r.humanReview);
console.log(`\n  Non-advisory FAILs: ${fails.length}${fails.length ? " — " + fails.map((f) => f.id).join(", ") : ""}`);
console.log(`  Class E is advisory only: every E verdict needs human review, whatever the model judge said.`);

const outPath = join(__dirname, "last-run.json");
writeFileSync(outPath, JSON.stringify({ ranAt: "(stamp externally)", proxy: PROXY_URL, results }, null, 2));
console.log(`\n  Full results (verdicts + FULL reply transcripts, no real data) → ${outPath}\n`);
