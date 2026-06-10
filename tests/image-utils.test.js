import { describe, it, expect } from "vitest";
import { needsTranscode, downscaleDims, OCR_SAFE_TYPES } from "../src/image-utils.js";

describe("needsTranscode — mime → transcode decision", () => {
  it("passes through jpeg/png/webp", () => {
    for (const t of OCR_SAFE_TYPES) expect(needsTranscode(t)).toBe(false);
    expect(needsTranscode("IMAGE/JPEG")).toBe(false); // case-insensitive
  });
  it("transcodes HEIC/HEIF and anything unknown", () => {
    expect(needsTranscode("image/heic")).toBe(true);
    expect(needsTranscode("image/heif")).toBe(true);
    expect(needsTranscode("image/gif")).toBe(true);
    expect(needsTranscode("")).toBe(true);
    expect(needsTranscode(undefined)).toBe(true);
  });
});

describe("downscaleDims — long-edge cap, aspect preserved", () => {
  it("caps a landscape 4000×3000 to 2000×1500", () => {
    expect(downscaleDims(4000, 3000)).toEqual({ width: 2000, height: 1500, scaled: true });
  });
  it("caps a portrait 1000×4000 to 500×2000", () => {
    expect(downscaleDims(1000, 4000)).toEqual({ width: 500, height: 2000, scaled: true });
  });
  it("leaves small images untouched", () => {
    expect(downscaleDims(1200, 800)).toEqual({ width: 1200, height: 800, scaled: false });
    expect(downscaleDims(2000, 2000)).toEqual({ width: 2000, height: 2000, scaled: false });
  });
  it("respects a custom max", () => {
    expect(downscaleDims(3000, 1500, 1000)).toEqual({ width: 1000, height: 500, scaled: true });
  });
  it("is a no-op on missing dimensions", () => {
    expect(downscaleDims(0, 0).scaled).toBe(false);
  });
});
