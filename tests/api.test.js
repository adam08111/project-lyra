import { describe, it, expect, vi, beforeEach } from "vitest";
import { callAI } from "../src/api.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

// SSE helper — build a ReadableStream that emits SSE-formatted chunks.
function sseStream(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

describe("callAI — non-streaming (no onChunk)", () => {
  it("POSTs to /api/gemini with system, message, maxTokens, stream:false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "ok" }),
    });

    await callAI("You are a coach", "Help me write");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/gemini");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json" });

    const body = JSON.parse(options.body);
    expect(body.system).toBe("You are a coach");
    expect(body.message).toBe("Help me write");
    expect(body.maxTokens).toBe(1000);
    expect(body.stream).toBe(false);
    expect(body.useSearch).toBeUndefined();
    expect(body.thinkingBudget).toBeUndefined();
    expect(body.model).toBeUndefined();
    expect(body.responseSchema).toBeUndefined();
  });

  it("returns plain text string when response has no sources", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "Hello student!" }),
    });

    const result = await callAI("system", "user message");
    expect(result).toBe("Hello student!");
  });

  it("returns { text, sources } object when grounding sources are present", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "From the web", sources: [{ title: "T", uri: "https://x" }] }),
    });

    const result = await callAI("system", "user message", true);
    expect(result).toEqual({ text: "From the web", sources: [{ title: "T", uri: "https://x" }] });
  });

  it("returns empty string when response has no text and no sources", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await callAI("system", "user message");
    expect(result).toBe("");
  });

  it("includes useSearch flag when requested", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "ok" }),
    });

    await callAI("system", "search this", true);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.useSearch).toBe(true);
  });

  it("includes thinkingBudget, model, responseSchema when passed", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "ok" }),
    });

    const schema = { type: "array", items: { type: "string" } };
    await callAI("system", "msg", false, 2048, 512, undefined, undefined, "gemini-flash-latest", schema);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.maxTokens).toBe(2048);
    expect(body.thinkingBudget).toBe(512);
    expect(body.model).toBe("gemini-flash-latest");
    expect(body.responseSchema).toEqual(schema);
  });

  it("passes signal through to fetch for abort support", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "ok" }),
    });

    const ctrl = new AbortController();
    await callAI("system", "msg", false, 1000, undefined, undefined, ctrl.signal);

    expect(mockFetch.mock.calls[0][1].signal).toBe(ctrl.signal);
  });

  it("forwards an array message (for vision parts) unchanged in body.message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: "extracted" }),
    });

    const parts = [
      { inline_data: { mime_type: "image/jpeg", data: "AAAA" } },
      { text: "Extract text" },
    ];
    await callAI("", parts, false, 2000, undefined, undefined, undefined, "gemini-flash-latest");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.message).toEqual(parts);
  });

  it("throws on non-OK response with status code in error message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    });

    await expect(callAI("system", "test")).rejects.toThrow(/429.*Rate limited/);
  });
});

describe("callAI — streaming (onChunk provided)", () => {
  it("does NOT send stream:false when onChunk is given (streaming mode)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => sseStream([`data: ${JSON.stringify({ text: "x" })}\n\n`, "data: [DONE]\n\n"]).getReader() },
    });

    await callAI("system", "msg", false, 1000, undefined, () => {});

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.stream).toBeUndefined();
  });

  it("accumulates streamed text chunks and returns the full string", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => sseStream([
        `data: ${JSON.stringify({ text: "Hello" })}\n\n`,
        `data: ${JSON.stringify({ text: " world" })}\n\n`,
        "data: [DONE]\n\n",
      ]).getReader() },
    });

    const seen = [];
    const result = await callAI("system", "msg", false, 1000, undefined, (partial) => seen.push(partial));
    expect(result).toBe("Hello world");
    expect(seen).toEqual(["Hello", "Hello world"]);
  });

  it("propagates an error payload as a thrown Error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => sseStream([
        `data: ${JSON.stringify({ error: "model overloaded" })}\n\n`,
        "data: [DONE]\n\n",
      ]).getReader() },
    });

    await expect(callAI("system", "msg", false, 1000, undefined, () => {})).rejects.toThrow("model overloaded");
  });

  it("silently skips non-JSON data lines instead of crashing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => sseStream([
        "data: not-json\n\n",
        `data: ${JSON.stringify({ text: "ok" })}\n\n`,
        "data: [DONE]\n\n",
      ]).getReader() },
    });

    const result = await callAI("system", "msg", false, 1000, undefined, () => {});
    expect(result).toBe("ok");
  });
});
