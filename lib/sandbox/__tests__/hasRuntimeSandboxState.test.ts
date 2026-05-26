import { describe, it, expect } from "vitest";
import { hasRuntimeSandboxState } from "@/lib/sandbox/hasRuntimeSandboxState";

const EXPIRES_AT = 4_102_444_800_000;

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

  it("returns false when sandboxName is set but expiresAt is absent (expired/cleared state)", () => {
    expect(hasRuntimeSandboxState({ type: "vercel", sandboxName: "session-x" })).toBe(false);
  });

  it("returns false when sandboxName is the empty string", () => {
    expect(hasRuntimeSandboxState({ type: "vercel", sandboxName: "", expiresAt: EXPIRES_AT })).toBe(false);
  });

  it("returns true when sandboxName and expiresAt are both present", () => {
    expect(
      hasRuntimeSandboxState({ type: "vercel", sandboxName: "session-x", expiresAt: EXPIRES_AT }),
    ).toBe(true);
  });

  it("returns false when expiresAt is present but sandboxName is absent", () => {
    expect(hasRuntimeSandboxState({ type: "vercel", expiresAt: EXPIRES_AT })).toBe(false);
  });
});
