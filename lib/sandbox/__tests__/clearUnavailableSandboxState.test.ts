import { describe, it, expect } from "vitest";
import { clearUnavailableSandboxState } from "@/lib/sandbox/clearUnavailableSandboxState";

describe("clearUnavailableSandboxState", () => {
  const stateWithResume = {
    type: "vercel",
    sandboxName: "session-abc",
    expiresAt: 12345,
  };

  it("drops the resume handle when the error indicates the sandbox no longer exists", () => {
    const result = clearUnavailableSandboxState(stateWithResume, "Sandbox not found");
    expect(result).toEqual({ type: "vercel" });
  });

  it("keeps the resume handle when the error is generic unavailability", () => {
    const result = clearUnavailableSandboxState(stateWithResume, "Sandbox is stopped");
    expect(result).toEqual({ type: "vercel", sandboxName: "session-abc" });
  });

  it("returns null when input state is null", () => {
    expect(clearUnavailableSandboxState(null, "any error")).toBeNull();
  });
});
