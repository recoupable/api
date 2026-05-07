import { describe, it, expect } from "vitest";
import { getSessionSandboxName } from "@/lib/sandbox/getSessionSandboxName";

describe("getSessionSandboxName", () => {
  it("returns a deterministic name prefixed with 'session-'", () => {
    expect(getSessionSandboxName("abc123")).toBe("session-abc123");
  });

  it("returns the same value for the same input", () => {
    const input = "uuid-style-id";
    expect(getSessionSandboxName(input)).toBe(getSessionSandboxName(input));
  });
});
