import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSet = vi.fn();

vi.mock("@/lib/redis/connection", () => ({
  default: {
    set: (...args: unknown[]) => mockSet(...args),
  },
}));

const { setCodingAgentPRState } = await import("../prState/setCodingAgentPRState");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setCodingAgentPRState", () => {
  it("stores serialized state in Redis", async () => {
    const state = {
      status: "pr_created" as const,
      snapshotId: "snap_abc",
      branch: "agent/fix-bug",
      repo: "recoupable/api",
      prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
    };

    await setCodingAgentPRState("recoupable/api", "agent/fix-bug", state);

    expect(mockSet).toHaveBeenCalledWith(
      "coding-agent:pr:recoupable/api:agent/fix-bug",
      JSON.stringify(state),
    );
  });
});
