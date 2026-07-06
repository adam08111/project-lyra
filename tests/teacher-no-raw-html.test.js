import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// §107 Class D — a SOURCE guard: the teacher surface must contain zero raw-HTML sinks. This
// greps every file under src/teacher/ for dangerouslySetInnerHTML / innerHTML= and fails on
// a hit. It is scoped so it CANNOT pass vacuously — it asserts the directory exists and has
// source files first (a missing/empty dir is a failure, not a silent green).
const TEACHER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "teacher");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

describe("§107 Class D — no raw-HTML sinks in src/teacher", () => {
  it("src/teacher exists and has source files (guard is not vacuous)", () => {
    expect(existsSync(TEACHER_DIR)).toBe(true);
    expect(walk(TEACHER_DIR).length).toBeGreaterThan(0);
  });

  it("no file uses dangerouslySetInnerHTML or assigns innerHTML", () => {
    // Match actual SINKS (a prop/assignment/call), not a mention in a comment — so the
    // files' own "there is NO dangerouslySetInnerHTML here" documentation stays allowed.
    for (const file of walk(TEACHER_DIR)) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} must not use dangerouslySetInnerHTML`).not.toMatch(/dangerouslySetInnerHTML\s*=/);
      expect(src, `${file} must not assign innerHTML`).not.toMatch(/\.innerHTML\s*=/);
      expect(src, `${file} must not use insertAdjacentHTML`).not.toMatch(/insertAdjacentHTML\s*\(/);
    }
  });
});
