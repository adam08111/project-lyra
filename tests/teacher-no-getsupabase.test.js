import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// §109 Layer 1 guard — the teacher surface must use its OWN isolated client
// (getTeacherClient), never the student's getSupabase(). Greps every file under
// src/teacher/ for a getSupabase( CALL and fails on a hit. Scoped so it can't pass
// vacuously (the dir must exist with source files); matches a call, not a comment mention.
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

describe("§109 — teacher surface uses its own isolated client, never getSupabase()", () => {
  it("src/teacher exists with source files (guard is not vacuous)", () => {
    expect(existsSync(TEACHER_DIR)).toBe(true);
    expect(walk(TEACHER_DIR).length).toBeGreaterThan(0);
  });

  it("no file under src/teacher calls getSupabase(", () => {
    for (const file of walk(TEACHER_DIR)) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} must not call getSupabase() — use getTeacherClient()`).not.toMatch(/getSupabase\(/);
    }
  });
});
