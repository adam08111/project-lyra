import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// No network: mock the SDK. (This test only exercises the flag-OFF path, where the SDK
// is never actually constructed, but the mock keeps the import graph network-free.)
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ __mock: true })) }));

describe("initSync — boot hook, flag off (§95)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    globalThis.window = {}; // initSync runs in the browser at boot; simulate the global
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete globalThis.window;
  });

  it("no env → resolves without throwing and exposes status() enabled:false", async () => {
    const { initSync } = await import("../src/sync-init.js");
    await expect(initSync()).resolves.toBeUndefined();
    expect(window.lyraSync).toBeTruthy();
    expect(window.lyraSync.status()).toEqual({ enabled: false });
  });
});
