import { describe, it, expect } from "vitest";
import { clientKey, rateLimited } from "../api/gemini.js";

// §102 F2: the best-effort per-identity rate limiter on the shipping proxy. These pin the
// key-selection (student_id vs IP fallback + the client-supplied-id clamp) and the sliding
// window boundary so a future refactor can't silently regress the billing floor.
const mkReq = (headers = {}, remote = "9.9.9.9") => ({ headers, socket: { remoteAddress: remote } });

describe("rate-limit clientKey (§102 F2)", () => {
  it("keys by student_id when the client forwards one", () => {
    expect(clientKey(mkReq(), { studentId: "abc-123" })).toBe("sid:abc-123");
  });

  it("falls back to the first x-forwarded-for hop, else the socket address", () => {
    expect(clientKey(mkReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }), {})).toBe("ip:1.2.3.4");
    expect(clientKey(mkReq({}, "9.9.9.9"), {})).toBe("ip:9.9.9.9");
    expect(clientKey(mkReq(), null)).toBe("ip:9.9.9.9");
  });

  it("treats a blank/whitespace student_id as absent (IP fallback)", () => {
    expect(clientKey(mkReq(), { studentId: "   " })).toBe("ip:9.9.9.9");
  });

  it("clamps a client-supplied student_id to 64 chars (memory hygiene)", () => {
    expect(clientKey(mkReq(), { studentId: "x".repeat(200) })).toBe("sid:" + "x".repeat(64));
  });
});

describe("rate-limit rateLimited (§102 F2)", () => {
  it("allows 40 requests in a window and blocks the 41st for the same key", () => {
    const key = "sid:boundary-test-key";
    for (let i = 0; i < 40; i++) expect(rateLimited(key)).toBe(false);
    expect(rateLimited(key)).toBe(true);
  });

  it("tracks each key independently", () => {
    // Exhaust one key; a different key is unaffected.
    const hot = "sid:hot-key";
    for (let i = 0; i < 41; i++) rateLimited(hot);
    expect(rateLimited(hot)).toBe(true);
    expect(rateLimited("sid:cold-key")).toBe(false);
  });
});
