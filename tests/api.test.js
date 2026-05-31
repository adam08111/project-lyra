import { describe, it, expect, vi, beforeEach } from "vitest";
import { callAI } from "../src/api.js";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("callAI", () => {
  it("posts to the Gemini proxy with system, message, maxTokens, and stream:false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "Hello student!" }),
    });

    const result = await callAI("You are a coach", "Help me write");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/gemini");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body.system).toBe("You are a coach");
    expect(body.message).toBe("Help me write");
    expect(body.maxTokens).toBe(1000);
    expect(body.stream).toBe(false);

    expect(result).toBe("Hello student!");
  });

  it("returns the text field from a non-streaming response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "Great work!" }),
    });

    const result = await callAI("system", "user message");
    expect(result).toBe("Great work!");
  });

  it("returns an empty string when the text field is absent", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await callAI("system", "user message");
    expect(result).toBe("");
  });

  it("returns { text, sources } when grounding sources are present", async () => {
    const sources = [{ title: "Source", url: "https://example.com" }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "Found it", sources }),
    });

    const result = await callAI("system", "search this", true);
    expect(result).toEqual({ text: "Found it", sources });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.useSearch).toBe(true);
  });

  it("omits useSearch, model, and thinkingBudget by default", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "ok" }),
    });

    await callAI("system", "no search");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.useSearch).toBeUndefined();
    expect(body.model).toBeUndefined();
    expect(body.thinkingBudget).toBeUndefined();
  });

  it("includes model, thinkingBudget, and a custom maxTokens when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "ok" }),
    });

    await callAI("system", "msg", false, 4096, 2048, undefined, undefined, "gemini-flash-latest");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.maxTokens).toBe(4096);
    expect(body.thinkingBudget).toBe(2048);
    expect(body.model).toBe("gemini-flash-latest");
  });

  it("forwards the abort signal to fetch", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "ok" }),
    });

    const controller = new AbortController();
    await callAI("system", "msg", false, 1000, undefined, undefined, controller.signal);

    expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("throws with the status and body text on a non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    });

    await expect(callAI("system", "test")).rejects.toThrow("API request failed (429): Rate limited");
  });

  it("streams SSE chunks through onChunk and returns the accumulated text", async () => {
    const sse = 'data: {"text":"Hello "}\ndata: {"text":"world"}\n';
    const bytes = new TextEncoder().encode(sse);
    const read = vi.fn()
      .mockResolvedValueOnce({ done: false, value: bytes })
      .mockResolvedValueOnce({ done: true, value: undefined });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => ({ read }) },
    });

    const chunks = [];
    const result = await callAI("system", "stream please", false, 1000, undefined, (t) => chunks.push(t));

    expect(result).toBe("Hello world");
    expect(chunks).toEqual(["Hello ", "Hello world"]);
  });
});
