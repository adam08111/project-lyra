import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// §109 Layer 1 — the teacher client must be a SEPARATE Supabase client with its own auth
// storageKey, so it can't overwrite the student's anonymous session. Mock createClient to
// capture the options each client is built with.
const h = vi.hoisted(() => ({ calls: [] }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (url, key, opts) => { h.calls.push({ url, key, opts }); return { __mock: true }; },
}));

beforeEach(() => { vi.resetModules(); vi.unstubAllEnvs(); h.calls = []; });
afterEach(() => { vi.unstubAllEnvs(); });

describe("§109 teacher client — storage isolation", () => {
  it("teacher client sets storageKey 'lyra-teacher-auth'; the student client does NOT", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://p.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-public-key");
    const { getSupabase } = await import("../src/supabase-client.js");
    const { getTeacherClient } = await import("../src/teacher/teacher-client.js");
    getSupabase();
    getTeacherClient();
    expect(h.calls).toHaveLength(2); // two DISTINCT clients
    const teacher = h.calls.find((c) => c.opts?.auth?.storageKey === "lyra-teacher-auth");
    const student = h.calls.find((c) => c.opts?.auth && c.opts.auth.storageKey === undefined);
    expect(teacher, "teacher client must set its own storageKey").toBeTruthy();
    expect(student, "student client must keep the default storageKey").toBeTruthy();
  });

  it("both clients consume the SAME single env config (no second env read / no divergence)", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://p.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-public-key");
    const { getSupabase } = await import("../src/supabase-client.js");
    const { getTeacherClient } = await import("../src/teacher/teacher-client.js");
    getSupabase();
    getTeacherClient();
    expect(h.calls[0].url).toBe(h.calls[1].url);
    expect(h.calls[0].key).toBe(h.calls[1].key);
  });

  it("getTeacherClient() → null when the flag is off (feeds §106's not-configured path)", async () => {
    const { getTeacherClient } = await import("../src/teacher/teacher-client.js");
    expect(getTeacherClient()).toBe(null);
    expect(h.calls).toHaveLength(0); // never built a client
  });

  it("getTeacherClient() memoizes (one client per session)", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://p.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-public-key");
    const { getTeacherClient } = await import("../src/teacher/teacher-client.js");
    const a = getTeacherClient();
    const b = getTeacherClient();
    expect(a).toBe(b);
    expect(h.calls).toHaveLength(1);
  });
});
