import { describe, it, expect, vi, beforeEach } from "vitest";
import { isAgentContext, getSandbox } from "@/lib/agent/tools/utils";

import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("isAgentContext", () => {
  it("returns true for a well-formed agent context", () => {
    expect(
      isAgentContext({
        sandbox: { state: {}, workingDirectory: "/sandbox/mono" },
      }),
    ).toBe(true);
  });

  it("returns false for non-object inputs", () => {
    expect(isAgentContext(undefined)).toBe(false);
    expect(isAgentContext(null)).toBe(false);
    expect(isAgentContext("nope")).toBe(false);
    expect(isAgentContext(42)).toBe(false);
  });

  it("returns false when `sandbox` is missing", () => {
    expect(isAgentContext({ model: {} })).toBe(false);
  });
});

describe("getSandbox", () => {
  it("reconnects via connectVercel(state) and returns the sandbox", async () => {
    const fakeSandbox = { workingDirectory: "/sandbox/mono" };
    vi.mocked(connectVercel).mockResolvedValue(fakeSandbox as never);
    const state = { sandboxName: "session-xyz" };
    const result = await getSandbox(
      { sandbox: { state, workingDirectory: "/sandbox/mono" } },
      "bash",
    );
    expect(result).toBe(fakeSandbox);
    expect(connectVercel).toHaveBeenCalledWith(state);
  });

  it("throws a descriptive error when context is missing", async () => {
    await expect(getSandbox(undefined, "bash")).rejects.toThrow(/Sandbox state missing/);
  });

  it("throws when context.sandbox.state is missing", async () => {
    await expect(
      getSandbox({ sandbox: { workingDirectory: "/x" } } as never, "bash"),
    ).rejects.toThrow(/Sandbox state missing/);
  });
});
