import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// §101 shim listener. window + in-memory localStorage; the shim assigns window.storage at
// import, so window must exist before load().
function makeLocalStorage() {
  let s = {};
  return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
    get length() { return Object.keys(s).length; },
    key: (i) => Object.keys(s)[i],
  };
}
const load = () => import("../src/storage-shim.js");

beforeEach(() => { vi.resetModules(); globalThis.window = {}; globalThis.localStorage = makeLocalStorage(); });
afterEach(() => { delete globalThis.window; delete globalThis.localStorage; });

describe("storage-shim — listener + byte-compatible API (§101)", () => {
  it("set/delete notify the registered listener with the key (post-write)", async () => {
    const { registerStorageListener } = await load();
    const seen = [];
    registerStorageListener((k) => seen.push(k));
    await window.storage.set("lyra-projects", "v");
    await window.storage.delete("lyra-projects");
    expect(seen).toEqual(["lyra-projects", "lyra-projects"]);
  });

  it("a THROWING listener never breaks a writer (#7 containment) and the write still lands", async () => {
    const { registerStorageListener } = await load();
    registerStorageListener(() => { throw new Error("boom"); });
    await expect(window.storage.set("lyra-projects", "v")).resolves.toEqual({ key: "lyra-projects", value: "v" });
    expect(localStorage.getItem("lyra-projects")).toBe("v");
  });

  it("get still THROWS on a missing key (caller API byte-identical)", async () => {
    await load();
    await expect(window.storage.get("nope")).rejects.toThrow("Key not found: nope");
  });

  it("reads (get/list) do NOT notify", async () => {
    const { registerStorageListener } = await load();
    const seen = [];
    registerStorageListener((k) => seen.push(k));
    localStorage.setItem("lyra-projects", "v");
    await window.storage.get("lyra-projects");
    await window.storage.list("lyra-");
    expect(seen).toHaveLength(0);
  });
});
