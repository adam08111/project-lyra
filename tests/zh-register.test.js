import { describe, it, expect } from "vitest";
import { toWrittenChinese } from "../src/zh-register.js";

describe("toWrittenChinese — spoken Cantonese -> standard written 書面語", () => {
  it("fixes the live bug sentence", () => {
    const cantonese = "喺英文入面，我哋唔會同時用 'although' 同埋 'but'。用其中一個就已經足夠表達對比。";
    const out = toWrittenChinese(cantonese);
    expect(out).toBe("在英文裡面，我們不會同時用 'although' 和 'but'。用其中一個就已經足夠表達對比。");
    // no spoken markers survive
    expect(out).not.toMatch(/[喺哋唔嘅係嚟嗰啲畀冇噉咁嘢佢]|同埋|入面/);
  });

  it("maps each core spoken token to its written form", () => {
    expect(toWrittenChinese("佢係好叻")).toBe("他是好叻"); // 叻 not in list, fine
    expect(toWrittenChinese("呢個係我嘅嘢")).toBe("呢個是我的東西"); // 呢 not mapped (kept minimal), rest converted
    expect(toWrittenChinese("我哋冇去")).toBe("我們沒有去");
  });

  it("does NOT corrupt 關係 (the 係 collision)", () => {
    expect(toWrittenChinese("這個技巧和論點的關係很重要")).toBe("這個技巧和論點的關係很重要");
    expect(toWrittenChinese("佢哋嘅關係")).toBe("他們的關係");
  });

  it("does NOT corrupt 進入面試 / 深入 (the 入面 false bigram)", () => {
    expect(toWrittenChinese("準備進入面試的環節")).toBe("準備進入面試的環節");
    expect(toWrittenChinese("深入面對問題")).toBe("深入面對問題");
    // but genuine Cantonese 入面 (inside) still converts
    expect(toWrittenChinese("喺盒入面")).toBe("在盒裡面");
  });

  it("leaves English and already-written Chinese untouched", () => {
    const mixed = "In English, you only need one conjunction. 用一個就足夠了。";
    expect(toWrittenChinese(mixed)).toBe(mixed);
    expect(toWrittenChinese("I got a Good Grade in GIL")).toBe("I got a Good Grade in GIL"); // no I/G/L corruption
  });

  it("passes through empty / non-string", () => {
    expect(toWrittenChinese("")).toBe("");
    expect(toWrittenChinese(null)).toBe(null);
    expect(toWrittenChinese(undefined)).toBe(undefined);
  });
});
