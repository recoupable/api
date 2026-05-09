import { describe, it, expect } from "vitest";
import { clearSandboxResumeState } from "@/lib/sandbox/clearSandboxResumeState";

describe("clearSandboxResumeState", () => {
  it("returns null when state is null or undefined", () => {
    expect(clearSandboxResumeState(null)).toBeNull();
    expect(clearSandboxResumeState(undefined)).toBeNull();
  });

  it("returns null when state is not an object", () => {
    expect(clearSandboxResumeState("oops" as unknown)).toBeNull();
  });

  it("preserves only the type discriminator, dropping any resume handles", () => {
    const result = clearSandboxResumeState({
      type: "vercel",
      sandboxName: "session-abc",
      sandboxId: "sbx_xyz",
      expiresAt: 12345,
    });
    expect(result).toEqual({ type: "vercel" });
  });

  it("falls back to type='vercel' when the input has no recognizable type", () => {
    const result = clearSandboxResumeState({ sandboxName: "session-abc" });
    expect(result).toEqual({ type: "vercel" });
  });
});
