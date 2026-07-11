// §116 — the SAVED-record contract for last-run.json. Split out of run.js so the shape of
// "what gets captured" is (a) unit-testable WITHOUT a live API call and (b) has one place
// that guarantees the FULL model reply is stored, not a 400-char slice.
//
// Why this exists: the §110.1 finding. `last-run.json` used to store `trunc(output, 400)`
// (whitespace-collapsed, 400 chars), so the class-E transcripts a HUMAN must read before the
// CIP application cites them were cut mid-reply — E1 (self-harm) mid-word, E2 (abuse) inside
// the hotline list, exactly where a safety reply can go wrong. The saved artifact is a
// transcript now: the attack-bearing input, the coach's reply IN FULL (whitespace preserved),
// and the verdict — so the maintainer's required class-E read is actually possible.
//
// Pure — no side effects, no network. This is the ONE vitest-safe module in tests/redteam/;
// the live harness (run.js) still makes real API calls and is NEVER wired into vitest/CI.

/**
 * Assemble the persisted result record for one live-judged red-team case.
 * The coach's reply is stored verbatim and untruncated, with its original whitespace, so a
 * human can read the complete attack → reply → verdict transcript (the class-E review gate).
 *
 * @param {object}  a
 * @param {object}  a.caseObj    the attack fixture ({id, class, route, judge, desc, ...})
 * @param {object}  a.call       the built proxy call ({system, message, model, ...})
 * @param {string}  a.output     the coach's FULL reply text (do not pre-truncate)
 * @param {object}  a.judgement  {verdict, method, reason}
 * @param {object}  a.exfil      {hits: [...]} from the deterministic exfil check
 * @param {object}  a.res        {ok, status} from the proxy call
 */
export function buildResultRecord({ caseObj, call, output, judgement, exfil, res }) {
  const c = caseObj || {};
  const k = call || {};
  const hits = (exfil && exfil.hits) || [];
  return {
    id: c.id,
    class: c.class,
    route: c.route,
    judge: c.judge,
    lang: c.lang || "en",
    humanReview: !!c.humanReview,
    // ── the transcript (attack side), verbatim ──
    desc: c.desc || "",
    passCriterion: c.passCriterion || "",
    attack: String(k.message || ""),          // the attack-bearing user turn, as sent
    systemChars: k.system ? k.system.length : 0, // the shipped brain was present, at this size
    // ── the verdict ──
    verdict: judgement.verdict,
    method: judgement.method,
    reason: judgement.reason,
    exfilLeak: hits.length > 0,
    exfilHits: hits.length,
    // ── the coach's reply, IN FULL — the §110.1 fix: no truncation, whitespace preserved ──
    output: String(output || ""),
    ok: !!(res && res.ok),
    status: res ? res.status : 0,
  };
}
