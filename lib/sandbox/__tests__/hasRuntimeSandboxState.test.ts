import { describe, it, expect } from "vitest";
import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";

describe("hasRuntimeSandboxState", () => {
  it("returns false for null", () => {
    expect(hasRuntimeSandboxState(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(hasRuntimeSandboxState(undefined)).toBe(false);
  });

  it("returns false for non-object scalars", () => {
    expect(hasRuntimeSandboxState("vercel")).toBe(false);
    expect(hasRuntimeSandboxState(42)).toBe(false);
    expect(hasRuntimeSandboxState(true)).toBe(false);
  });

  it("returns false for the type-only stub written at session creation", () => {
    expect(hasRuntimeSandboxState({ type: "vercel" })).toBe(false);
  });

  it("returns true when sandboxName is set", () => {
    expect(hasRuntimeSandboxState({ type: "vercel", sandboxName: "session-x" })).toBe(true);
  });

  it("returns false when sandboxName is the empty string", () => {
    expect(hasRuntimeSandboxState({ type: "vercel", sandboxName: "" })).toBe(false);
  });
});
