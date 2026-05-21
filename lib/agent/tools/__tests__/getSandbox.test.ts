import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSandbox } from "@/lib/agent/tools/getSandbox";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";

vi.mock("@/lib/sandbox/vercel/connect/connectVercel", () => ({
  connectVercel: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

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

  it("throws a descriptive error when context is missing entirely", async () => {
    await expect(getSandbox(undefined, "bash")).rejects.toThrow(/Sandbox state missing/);
  });

  it("throws when sandbox.state is missing", async () => {
    await expect(
      getSandbox({ sandbox: { workingDirectory: "/x" } } as never, "bash"),
    ).rejects.toThrow(/Sandbox state missing/);
  });

  it("throws when sandbox.workingDirectory is empty (tightened guard)", async () => {
    await expect(
      getSandbox({ sandbox: { state: {}, workingDirectory: "" } } as never, "bash"),
    ).rejects.toThrow(/Sandbox state missing/);
  });
});
