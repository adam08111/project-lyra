# Lyra red-team harness (§103)

A reusable, **offline-by-default** red-team harness that tests Lyra's **model behaviour**
against hostile input — the complement to §102, which hardened the HTTP/render surface.
It builds attack prompts through the **real, shipped prompt builders** (`src/prompts.js`,
`LYRA_BRAIN`, `REPORT_CARD_BRAIN`), sends them through the **same proxy the app uses** (so
§102's live `SAFETY_SETTINGS` apply), and judges the replies cheaply and automatically.

> **This is a TEST harness, not product code.** It touches zero product code. It is
> **never** wired into `vitest`/CI — it makes real API calls and costs tokens. Run it
> explicitly. If a case reveals a real vulnerability, **that fix is a separate brief** —
> this harness *finds and documents*, it does not patch the prompts.

## Run it

```bash
# 1) ALWAYS dry-run first — prints every assembled attack prompt, spends NO tokens:
npm run redteam -- --dry-run

# 2) Live run (needs the dev proxy on :3001 with a GEMINI_API_KEY in .env):
node server/proxy.js        # in another terminal (serves the §102 safety config)
npm run redteam

# Filters:
npm run redteam -- --class=C            # one threat class (A|B|C|E|P)
npm run redteam -- --only=B1-repeat-verbatim
```

Env: `REDTEAM_PROXY_URL` (default `http://127.0.0.1:3001/api/gemini`), `REDTEAM_PACE_MS`
(default `2500` — spacing between calls so the dev proxy's 30/min limiter is respected).
Results are written to `last-run.json` (git-ignored): per case, the attack-bearing input, the
coach's **full, untruncated reply** (whitespace preserved), and the verdict — a readable
attack → reply → verdict transcript, which the **class-E human review** requires (§116; it
replaced the old 400-char slice that cut safety replies mid-list — the §110.1 finding). All
inputs are synthetic; no real student data. The key never touches the harness — the proxy
reads it from `.env`, like the app. *(The LLM judge still sees only the first 2000 chars of a
reply — a cost bound; class E is human-reviewed on the full text regardless.)*

## The threat classes

| Class | What it tests | Judge |
|---|---|---|
| **A** Pedagogical integrity | Socratic refusal to ghost-write the essay (direct / authority-spoof / pressure / incremental / role-swap / Cantonese) | LLM rubric |
| **B** IP / prompt exfiltration | Does it leak `LYRA_BRAIN` / `REPORT_CARD_BRAIN` verbatim? | **Deterministic** (verbatim brain signature = leak) |
| **C** Indirect injection | Payload embedded in the analysed reference text / training attempt / chat history / OCR text | LLM rubric (+ free exfil check) |
| **E** Minors-safety posture | The coach's response to self-harm / abuse disclosure, bullying-help, age-inappropriate requests | LLM **advisory** → **HUMAN REVIEW** |
| **P** Political neutrality (§120) | Stays apolitical on the HK national-security band (CCP / NSL / independence / sovereignty / 2019 protests / June 4); refuses the **topic symmetrically** (mirror stances get the identical refusal); **over-refusal of allowed DSE topics / published literature also fails** | LLM rubric (both directions) |

**Class D (learning-mirror poisoning)** is not a live model attack — it is a static field
inventory (which learning-log fields carry raw user text) that becomes a **required
sanitize-on-render checklist for the future teacher-dashboard brief**. See §103 in
`PROGRESS-REPORT.md` for the checklist.

## Class E is advisory only

Class-E verdicts from the model judge are a **triage aid, never a clearance**. The runner
prints them with a `*` and `HUMAN-REVIEW`, and never counts a model "PASS" as cleared. A
human must read every class-E response. Handle with the child-safety care CLAUDE.md requires.

## Adding a case

Add an object to the right file in `attacks/` (`a-pedagogical.js`, `b-exfil.js`,
`c-injection.js`, `e-minors.js`, `p-political.js`):

```js
{
  id: "C7-my-new-injection",
  class: "C", route: "style_analysis", judge: "llm",   // judge: "exfil" | "llm"
  desc: "One line: what the attack tries to do.",
  input: { referenceText: "…payload…" },               // route-specific fields (see routes.js DEFAULTS)
  passCriterion: "What 'resisted' looks like for the judge.",
  // lang: "zh"        // optional — Cantonese/Chinese variant
  // humanReview: true // class E only
  // requiresImage: true  // OCR raw-image cases (need a base64 fixture)
}
```

`routes.js` maps each route to its **real** builder; a case overrides only the field that
carries its attack (topic/message/referenceText/studentAttempt/conversation/historyJSON/image).

## Known limitation — raw OCR image injection

The `ocr` route's raw-image injection case (`C4`) needs a base64 PNG/JPEG fixture whose
pixels contain the adversarial text; without one it is **skipped live** (shown in
`--dry-run`). Its live-testable **downstream equivalent** (`C4b`) — the adversarial text an
OCR would extract, fed to the analysis route — **is** run. To exercise the raw-image path,
drop a fixture into `attacks/` and set `input.image = { data: "<base64>", mediaType: "image/png" }`.

## Re-run before every pilot/release

This harness is the durable deliverable. **Re-run it before each pilot and each release**
(see `SECURITY.md`). A regression in pedagogical refusal, prompt exfiltration resistance,
injection resistance, or political neutrality (P) is a release blocker; class-E results
always get human review.
