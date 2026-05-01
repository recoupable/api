import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDel = vi.fn();

vi.mock("@/lib/redis/connection", () => ({
  default: {
    del: (...args: unknown[]) => mockDel(...args),
  },
}));

const { deleteCodingAgentPRState } = await import("../prState/deleteCodingAgentPRState");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteCodingAgentPRState", () => {
  it("deletes the key from Redis", async () => {
    await deleteCodingAgentPRState("recoupable/api", "agent/fix-bug");
    expect(mockDel).toHaveBeenCalledWith("coding-agent:pr:recoupable/api:agent/fix-bug");
  });
});
