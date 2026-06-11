import { describe, it, expect } from "vitest";
import { formatSources } from "../src/utils.js";

describe("formatSources — compact source pills", () => {
  it("prefers a hostname-looking title over the redirect uri's hostname", () => {
    const out = formatSources([{ title: "scmp.com", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc" }]);
    expect(out).toEqual([{ label: "scmp.com", url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc" }]);
  });

  it("falls back to the uri hostname (www stripped) when title is prose", () => {
    const out = formatSources([{ title: "An article about schools", uri: "https://www.hk01.com/article/123" }]);
    expect(out[0].label).toBe("hk01.com");
  });

  it("caps at 4 and dedupes by label", () => {
    const six = ["a.com", "b.com", "a.com", "c.com", "d.com", "e.com"].map(t => ({ title: t, uri: `https://${t}/x` }));
    const out = formatSources(six);
    expect(out).toHaveLength(4);
    expect(out.map(s => s.label)).toEqual(["a.com", "b.com", "c.com", "d.com"]);
  });

  it("skips malformed entries instead of throwing", () => {
    const out = formatSources([
      null,
      { title: "", uri: "not a url" },
      { title: "good.com", uri: "https://redirect/ok" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("good.com");
  });

  it("handles non-array input", () => {
    expect(formatSources(undefined)).toEqual([]);
  });
});
