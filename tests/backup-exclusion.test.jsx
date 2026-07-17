// @vitest-environment happy-dom
//
// BRIEF-PRV / §128 (D-P4) — regression pin for the backup-credential audit the §127 review surfaced.
// DataExport ("Backup (.json)") composes {exportedAt, version, projects, grammarLog} from its props only
// — it never reads localStorage, so the §121 recovery code (a claim-capable bearer credential) is NOT in
// the file kids share. This test seeds the code into storage and proves it stays out of the backup, so a
// future change to wholesale-serialize storage would break here.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

const h = vi.hoisted(() => ({ downloads: [] }));
vi.mock("../src/export/download.js", () => ({ downloadBlob: (name, text) => h.downloads.push({ name, text }) }));

import DataExport from "../src/components/DataExport.jsx";
const btn = (c, re) => [...c.querySelectorAll("button")].find((b) => re.test(b.textContent));

beforeEach(() => { h.downloads = []; localStorage.clear(); });

describe("DataExport 'Backup (.json)' — the recovery credential never rides along (D-P4)", () => {
  it("serializes only projects + grammarLog; a stored recovery code is absent from the file", () => {
    localStorage.setItem("lyra-recovery-code", "ABCD-EFGH-JKLM-NPQR");   // present in storage, must NOT travel
    const { container } = render(<DataExport projects={[{ id: "d", name: "n", writings: [{ id: "w", title: "T", draft: "hi" }] }]} grammarLog={[{ rule: "SVA" }]} />);
    fireEvent.click(btn(container, /Backup/i));
    expect(h.downloads).toHaveLength(1);
    expect(h.downloads[0].name).toMatch(/^lyra-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const data = JSON.parse(h.downloads[0].text);
    expect(Object.keys(data).sort()).toEqual(["exportedAt", "grammarLog", "projects", "version"]);
    expect(h.downloads[0].text).not.toContain("ABCD-EFGH-JKLM-NPQR");
    expect(h.downloads[0].text.toLowerCase()).not.toContain("recovery");
  });
});
