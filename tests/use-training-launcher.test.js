// @vitest-environment happy-dom
//
// §104 (D1) CHARACTERIZATION test for the first lyra.jsx decomposition seam. It pins the
// CURRENT behaviour of the training-launcher (as it was inline in lyra.jsx lines 89-98) so
// the extraction into useTrainingLauncher is provably behaviour-frozen — this passes
// against the extracted hook and MUST keep passing byte-for-byte. (Per-file happy-dom env;
// the other 523 tests stay node-env and are untouched.)
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTrainingLauncher } from "../src/hooks.js";

describe("useTrainingLauncher (§104 characterization — behaviour frozen)", () => {
  it("starts closed (both null)", () => {
    const { result } = renderHook(() => useTrainingLauncher());
    expect(result.current.trainingSkill).toBe(null);
    expect(result.current.trainingStartTech).toBe(null);
  });

  it("opens with the given skill and an integer start-technique index", () => {
    const { result } = renderHook(() => useTrainingLauncher());
    const skill = { authorName: "Polly", techniques: ["x"] };
    act(() => result.current.openTrainingSession(skill, 2));
    expect(result.current.trainingSkill).toBe(skill);
    expect(result.current.trainingStartTech).toBe(2);
  });

  it("keeps startTech = 0 (index 0 is a valid technique, Number.isInteger(0) is true)", () => {
    const { result } = renderHook(() => useTrainingLauncher());
    act(() => result.current.openTrainingSession({ n: 1 }, 0));
    expect(result.current.trainingStartTech).toBe(0);
  });

  it("falls back to the overview (startTech = null) for a non-integer techIdx", () => {
    const { result } = renderHook(() => useTrainingLauncher());
    const skill = { authorName: "Polly" };
    act(() => result.current.openTrainingSession(skill)); // undefined
    expect(result.current.trainingSkill).toBe(skill);
    expect(result.current.trainingStartTech).toBe(null);
    act(() => result.current.openTrainingSession(skill, "3")); // string
    expect(result.current.trainingStartTech).toBe(null);
    act(() => result.current.openTrainingSession(skill, 1.5)); // non-integer number
    expect(result.current.trainingStartTech).toBe(null);
  });

  it("closeTrainingSession clears both back to null", () => {
    const { result } = renderHook(() => useTrainingLauncher());
    act(() => result.current.openTrainingSession({ n: 1 }, 2));
    act(() => result.current.closeTrainingSession());
    expect(result.current.trainingSkill).toBe(null);
    expect(result.current.trainingStartTech).toBe(null);
  });

  it("callbacks are referentially stable across re-renders (useCallback []) — children get stable props", () => {
    const { result, rerender } = renderHook(() => useTrainingLauncher());
    const open1 = result.current.openTrainingSession;
    const close1 = result.current.closeTrainingSession;
    rerender();
    expect(result.current.openTrainingSession).toBe(open1);
    expect(result.current.closeTrainingSession).toBe(close1);
  });
});
