// Vite launcher for Claude Code on the web's preview tool.
//
// FOOTGUN: this script lives at src/.claude/start-vite.mjs, so import.meta.url
// resolves to .../src/.claude/. If you run `vite` from here, Vite serves src/
// — there's no index.html in src/ and the app shows the old onboarding UI or
// a 404. Fix: explicitly cd to the project root (two levels up) before
// spawning Vite.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..", "..");

const child = spawn("npx", ["vite", "--host", "0.0.0.0"], {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
