import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();

vi.mock("@/lib/redis/connection", () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

const { getCodingAgentPRState } = await import("../prState/getCodingAgentPRState");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCodingAgentPRState", () => {
  it("returns null when key does not exist", async () => {
    mockGet.mockResolvedValue(null);
    const result = await getCodingAgentPRState("recoupable/api", "agent/fix-bug");
    expect(result).toBeNull();
    expect(mockGet).toHaveBeenCalledWith("coding-agent:pr:recoupable/api:agent/fix-bug");
  });

  it("returns parsed state when key exists", async () => {
    const state = {
      status: "pr_created",
      branch: "agent/fix-bug",
      repo: "recoupable/api",
      prs: [
        {
          repo: "recoupable/api",
          number: 42,
          url: "https://github.com/recoupable/api/pull/42",
          baseBranch: "test",
        },
      ],
    };
    mockGet.mockResolvedValue(JSON.stringify(state));

    const result = await getCodingAgentPRState("recoupable/api", "agent/fix-bug");
    expect(result).toEqual(state);
  });
});
