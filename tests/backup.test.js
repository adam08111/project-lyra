import { describe, it, expect, vi, afterEach } from "vitest";

// Controllable localStorage stub installed before import.
const store = new Map();
let throwOnSet = null; // null | Error to throw from setItem
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { if (throwOnSet) throw throwOnSet; store.set(k, String(v)); },
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { snapshotBackup } = await import("../src/backup.js");

afterEach(() => {
  throwOnSet = null;
  store.clear();
  vi.restoreAllMocks();
});

describe("snapshotBackup — quota failures are no longer silent", () => {
  it("warns explicitly about quota and returns false on QuotaExceededError", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const quotaErr = new Error("exceeded");
    quotaErr.name = "QuotaExceededError";
    throwOnSet = quotaErr;

    expect(snapshotBackup()).toBe(false);
    expect(warn).toHaveBeenCalled();
    const msg = warn.mock.calls.map(c => c.join(" ")).join("\n");
    expect(msg).toContain("quota");
    expect(msg).toContain("NOT being updated");
  });

  it("warns (generic) and returns false on any other error", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    throwOnSet = new TypeError("something else broke");

    expect(snapshotBackup()).toBe(false);
    expect(warn).toHaveBeenCalled();
    const msg = warn.mock.calls.map(c => c.join(" ")).join("\n");
    expect(msg).toContain("snapshot failed");
    expect(msg).toContain("TypeError");
  });
});
