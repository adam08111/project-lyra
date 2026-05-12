import { describe, it, expect, vi, beforeEach } from "vitest";
import { callAI } from "../src/api.js";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("callAI", () => {
  it("sends POST request with correct structure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: "Hello student!" }] }),
    });

    const result = await callAI("You are a coach", "Help me write");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body);
    expect(body.model).toBe("claude-sonnet-4-6");
    expect(body.max_tokens).toBe(1000);
    expect(body.system).toBe("You are a coach");
    expect(body.messages).toEqual([{ role: "user", content: "Help me write" }]);
  });

  it("returns text content from response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: "Great work!" }] }),
    });

    const result = await callAI("system", "user message");
    expect(result).toBe("Great work!");
  });

  it("joins multiple text blocks", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: "Part 1" }, { text: "Part 2" }] }),
    });

    const result = await callAI("system", "user message");
    expect(result).toBe("Part 1\nPart 2");
  });

  it("returns empty string if no content", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [] }),
    });

    const result = await callAI("system", "user message");
    expect(result).toBe("");
  });

  it("includes web search tool when requested", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: "Found info" }] }),
    });

    await callAI("system", "search this", true);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools).toEqual([{ type: "web_search_20250305", name: "web_search" }]);
  });

  it("does not include tools when search is false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: "response" }] }),
    });

    await callAI("system", "no search");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
  });

  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    });

    await expect(callAI("system", "test")).rejects.toThrow("API request failed (429)");
  });

  it("filters out non-text blocks", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: "text" }, { type: "tool_use" }, { text: "" }, { text: "more" }] }),
    });

    const result = await callAI("system", "test");
    expect(result).toBe("text\nmore");
  });
});
