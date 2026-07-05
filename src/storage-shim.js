// Shim: makes window.storage API work using localStorage
// This lets lyra.jsx run unchanged outside Claude artifacts

// §101 (Layer 1 blob durability): a single post-write listener the SYNC LAYER registers
// into (blob capture). The shim itself imports NOTHING — registerStorageListener is called
// from initSync, so there is no dependency cycle. The caller-facing window.storage API and
// its semantics (incl. get-throws-on-missing) are byte-identical; the listener is a pure
// side-channel and a listener failure must NEVER throw into a caller (#7).
let _writeListener = null;
export function registerStorageListener(fn) {
  _writeListener = typeof fn === "function" ? fn : null;
}
function notifyWrite(key) {
  try { if (_writeListener) _writeListener(key); } catch (e) { /* contained — never break a writer */ }
}

if (typeof window !== "undefined") {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(key);
      if (value === null) throw new Error("Key not found: " + key);
      return { key, value };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      notifyWrite(key);           // §101: post-write, after the store is durable
      return { key, value };
    },
    async delete(key) {
      localStorage.removeItem(key);
      notifyWrite(key);           // §101: emptying/deleting mirrors as a tombstone
      return { key, deleted: true };
    },
    async list(prefix = "") {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith(prefix)) keys.push(k);
      }
      return { keys, prefix };
    },
  };
}
