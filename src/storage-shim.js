// Shim: makes window.storage API work using localStorage
// This lets lyra.jsx run unchanged outside Claude artifacts

window.storage = {
  async get(key) {
    const value = localStorage.getItem(key);
    if (value === null) throw new Error("Key not found: " + key);
    return { key, value };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
  async delete(key) {
    localStorage.removeItem(key);
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
