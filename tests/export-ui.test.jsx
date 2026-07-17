// @vitest-environment happy-dom
//
// BRIEF-116 / §127 — the "Take your work home" Sidebar action. gather/compose/download are mocked;
// this proves the never-stuck UI (#7): a corpus with content downloads the dated .html; an empty
// corpus shows an honest empty state and downloads nothing; a failure shows a retryable error.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ gather: null, throwGather: false, downloadCalls: [] }));
vi.mock("../src/export/gather.js", () => ({ gatherCorpus: () => (h.throwGather ? Promise.reject(new Error("boom")) : Promise.resolve(h.gather)) }));
vi.mock("../src/export/compose.js", () => ({ composeExport: () => "<!doctype html><html></html>", escapeHtml: (s) => s }));
vi.mock("../src/export/download.js", () => ({ downloadBlob: (...args) => h.downloadCalls.push(args) }));

import TakeHomeExport from "../src/components/TakeHomeExport.jsx";
const btn = (c, re) => [...c.querySelectorAll("button")].find((b) => re.test(b.textContent));

beforeEach(() => { h.gather = null; h.throwGather = false; h.downloadCalls = []; });

describe("TakeHomeExport — the Sidebar action", () => {
  it("renders the action", () => {
    const { container } = render(<TakeHomeExport />);
    expect(btn(container, /Take your work home/i)).toBeTruthy();
  });

  it("with content → downloads a dated lyra-my-work-*.html and confirms", async () => {
    h.gather = { corpus: { writings: [{}], learning: null, growth: null, snapshots: null }, included: ["1 writing"], omitted: [] };
    const { container } = render(<TakeHomeExport />);
    fireEvent.click(btn(container, /Take your work home/i));
    await waitFor(() => expect(h.downloadCalls.length).toBe(1));
    expect(h.downloadCalls[0][0]).toMatch(/^lyra-my-work-\d{4}-\d{2}-\d{2}\.html$/);
    expect(container.textContent).toMatch(/yours to keep/i);
  });

  it("empty corpus → honest empty state, no download", async () => {
    h.gather = { corpus: { writings: [], learning: null, growth: null, snapshots: null }, included: [], omitted: [] };
    const { container } = render(<TakeHomeExport />);
    fireEvent.click(btn(container, /Take your work home/i));
    await waitFor(() => expect(container.textContent).toMatch(/nothing to take home/i));
    expect(h.downloadCalls.length).toBe(0);
  });

  it("failure → a visible, retryable error (never-stuck)", async () => {
    h.throwGather = true;
    const { container } = render(<TakeHomeExport />);
    fireEvent.click(btn(container, /Take your work home/i));
    await waitFor(() => expect(container.textContent).toMatch(/couldn't create your file/i));
    expect(btn(container, /Try again/i)).toBeTruthy();
  });
});
