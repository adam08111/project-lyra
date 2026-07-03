import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// No network: mock the SDK entirely. createClient returns a sentinel so we can assert
// getSupabase() memoization without ever touching Supabase.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn((url, key) => ({ __mockClient: true, url, key })),
}));

describe("supabase-client — feature-flagged, never throws (§95)", () => {
  beforeEach(() => {
    vi.resetModules();      // fresh module → reset the getSupabase memo per test
    vi.unstubAllEnvs();
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("getSupabase() → null when the env vars are unset (flag off)", async () => {
    const { getSupabase } = await import("../src/supabase-client.js");
    expect(getSupabase()).toBe(null);
  });

  it("getSupabase() → null when only ONE var is set", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://proj.supabase.co");
    const { getSupabase } = await import("../src/supabase-client.js");
    expect(getSupabase()).toBe(null);
  });

  it("getSupabase() → a memoized client when BOTH vars are stubbed", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://proj.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-public-key");
    const { getSupabase } = await import("../src/supabase-client.js");
    const client = getSupabase();
    expect(client).toBeTruthy();
    expect(client.__mockClient).toBe(true);
    expect(getSupabase()).toBe(client); // same instance (memoized)
  });

  it("ensureStudent() → null and does NOT throw when the client is null (flag off)", async () => {
    const { ensureStudent } = await import("../src/supabase-client.js");
    await expect(ensureStudent()).resolves.toBe(null);
  });
});
