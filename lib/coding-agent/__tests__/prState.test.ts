import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();

vi.mock("@/lib/redis/connection", () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args),
    del: (...args: unknown[]) => mockDel(...args),
  },
}));

const { buildPRStateKey, getCodingAgentPRState, setCodingAgentPRState, deleteCodingAgentPRState } =
  await import("../prState");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildPRStateKey", () => {
  it("builds the correct key", () => {
    expect(buildPRStateKey("recoupable/api", "agent/fix-bug")).toBe(
      "coding-agent:pr:recoupable/api:agent/fix-bug",
    );
  });
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
      snapshotId: "snap_abc",
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

describe("deleteCodingAgentPRState", () => {
  it("deletes the key from Redis", async () => {
    await deleteCodingAgentPRState("recoupable/api", "agent/fix-bug");
    expect(mockDel).toHaveBeenCalledWith("coding-agent:pr:recoupable/api:agent/fix-bug");
  });
});
