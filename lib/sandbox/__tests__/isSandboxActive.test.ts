import { describe, it, expect } from "vitest";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";
import { runtimeSandboxState } from "@/lib/sandbox/__tests__/fixtures/runtimeSandboxState";

const FAR_FUTURE = "2099-01-01T00:00:00.000Z";
const FAR_PAST = "2000-01-01T00:00:00.000Z";

const baseRow = {
  sandbox_state: null as unknown,
  sandbox_expires_at: null as string | null,
};

describe("isSandboxActive", () => {
  it("returns false when sandbox_state has no runtime metadata", () => {
    expect(isSandboxActive({ ...baseRow, sandbox_state: { type: "vercel" } } as any)).toBe(false);
  });

  it("returns false when sandbox_state is null", () => {
    expect(isSandboxActive({ ...baseRow } as any)).toBe(false);
  });

  it("returns true with a runtime sandboxName and a far-future expiry", () => {
    expect(
      isSandboxActive({
        ...baseRow,
        sandbox_state: runtimeSandboxState("session-x"),
        sandbox_expires_at: FAR_FUTURE,
      } as any),
    ).toBe(true);
  });

  it("returns false when expiry is in the past", () => {
    expect(
      isSandboxActive({
        ...baseRow,
        sandbox_state: runtimeSandboxState("session-x"),
        sandbox_expires_at: FAR_PAST,
      } as any),
    ).toBe(false);
  });

  it("returns true when runtime state is live but sandbox_expires_at column is null", () => {
    expect(
      isSandboxActive({
        ...baseRow,
        sandbox_state: runtimeSandboxState("session-x"),
        sandbox_expires_at: null,
      } as any),
    ).toBe(true);
  });
});
