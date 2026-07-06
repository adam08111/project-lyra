import { describe, it, expect, vi, beforeEach } from "vitest";

// §106 — unit-test the teacher auth module against a MOCKED Supabase client (no network).
// We mock the client module so getTeacherClient() returns exactly what each case needs.
vi.mock("../src/teacher/teacher-client.js", () => ({ getTeacherClient: vi.fn() }));

import { getTeacherClient } from "../src/teacher/teacher-client.js";
import { currentTeacher, signIn, signOut } from "../src/teacher/auth.js";

// A configurable fake client mirroring the exact call shapes auth.js uses:
//   auth.getSession() → { data: { session } }
//   auth.signInWithPassword({email,password}) → { error }  (success sets the session)
//   auth.signOut() → (may throw)
//   from("teachers").select("id, display_name").limit(1) → { data, error }
function makeClient(opts = {}) {
  const state = { session: opts.session ?? null };
  return {
    _state: state,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: state.session } })),
      signInWithPassword: vi.fn(async ({ email, password }) => {
        state.lastEmail = email;
        state.lastPassword = password;
        if (opts.signInError) return { error: opts.signInError };
        state.session = { user: { id: "auth-teacher-1" } };
        return { error: null };
      }),
      signOut: vi.fn(async () => { if (opts.signOutThrows) throw new Error("network"); return {}; }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(async () => {
          if (opts.teacherError) return { data: null, error: opts.teacherError };
          return { data: opts.teacherRows ?? [], error: null };
        }),
      })),
    })),
  };
}

beforeEach(() => { getTeacherClient.mockReset(); });

describe("teacher auth — currentTeacher()", () => {
  it("→ not-configured when Supabase is off (getTeacherClient null)", async () => {
    getTeacherClient.mockReturnValue(null);
    expect(await currentTeacher()).toEqual({ ok: false, error: "not-configured" });
  });

  it("→ signed-out when there is no session", async () => {
    getTeacherClient.mockReturnValue(makeClient({ session: null }));
    expect(await currentTeacher()).toEqual({ ok: false, error: "signed-out" });
  });

  it("→ ok with the teacher row when signed in and mapped", async () => {
    getTeacherClient.mockReturnValue(makeClient({
      session: { user: { id: "u" } },
      teacherRows: [{ id: "t1", display_name: "Ms Chan" }],
    }));
    expect(await currentTeacher()).toEqual({ ok: true, teacher: { id: "t1", display_name: "Ms Chan" } });
  });

  it("→ no-teacher-row when the session exists but no teachers row maps to it", async () => {
    getTeacherClient.mockReturnValue(makeClient({ session: { user: { id: "u" } }, teacherRows: [] }));
    expect(await currentTeacher()).toEqual({ ok: false, error: "no-teacher-row" });
  });

  it("→ query-failed when the teachers select errors", async () => {
    getTeacherClient.mockReturnValue(makeClient({ session: { user: { id: "u" } }, teacherError: { code: "42501" } }));
    expect(await currentTeacher()).toEqual({ ok: false, error: "query-failed" });
  });

  it("→ threw (never propagates) when the client throws", async () => {
    getTeacherClient.mockReturnValue({ auth: { getSession: async () => { throw new Error("boom"); } } });
    expect(await currentTeacher()).toEqual({ ok: false, error: "threw" });
  });
});

describe("teacher auth — signIn()", () => {
  it("→ ok with the teacher after a successful sign-in", async () => {
    getTeacherClient.mockReturnValue(makeClient({ teacherRows: [{ id: "t2", display_name: "Mr Wong" }] }));
    expect(await signIn("teacher@example.com", "pw")).toEqual({ ok: true, teacher: { id: "t2", display_name: "Mr Wong" } });
  });

  it("→ bad-credentials when the password is wrong", async () => {
    getTeacherClient.mockReturnValue(makeClient({ signInError: { status: 400, name: "AuthApiError" } }));
    expect(await signIn("teacher@example.com", "wrong")).toEqual({ ok: false, error: "bad-credentials" });
  });

  it("→ not-configured when Supabase is off", async () => {
    getTeacherClient.mockReturnValue(null);
    expect(await signIn("a@b.com", "pw")).toEqual({ ok: false, error: "not-configured" });
  });

  it("trims the email before sign-in", async () => {
    const client = makeClient({ teacherRows: [{ id: "t3", display_name: "T" }] });
    getTeacherClient.mockReturnValue(client);
    await signIn("  spaced@example.com  ", "pw");
    expect(client._state.lastEmail).toBe("spaced@example.com");
  });

  it("→ threw when the auth call throws", async () => {
    getTeacherClient.mockReturnValue({ auth: { signInWithPassword: async () => { throw new Error("net"); } } });
    expect(await signIn("a@b.com", "pw")).toEqual({ ok: false, error: "threw" });
  });
});

describe("teacher auth — signOut()", () => {
  it("→ ok and never throws on success", async () => {
    getTeacherClient.mockReturnValue(makeClient({ session: { user: { id: "u" } } }));
    expect(await signOut()).toEqual({ ok: true });
  });

  it("→ swallows a thrown error and reports threw (never propagates)", async () => {
    getTeacherClient.mockReturnValue(makeClient({ signOutThrows: true }));
    expect(await signOut()).toEqual({ ok: false, error: "threw" });
  });

  it("→ ok (no-op) when Supabase is off", async () => {
    getTeacherClient.mockReturnValue(null);
    expect(await signOut()).toEqual({ ok: true });
  });
});
