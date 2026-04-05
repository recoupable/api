import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetPRState = vi.fn();

vi.mock("../prState", () => ({
  getCodingAgentPRState: (...args: unknown[]) => mockGetPRState(...args),
}));

const { resolvePRState } = await import("../resolvePRState");

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 *
 * @param state
 */
function createMockThread(state: unknown) {
  return {
    id: "slack:C123:ts",
    get state() {
      return Promise.resolve(state);
    },
  } as any;
}

describe("resolvePRState", () => {
  it("returns thread state when available", async () => {
    const threadState = {
      status: "pr_created",
      prompt: "fix bug",
      branch: "agent/fix",

      prs: [{ repo: "recoupable/api", number: 1, url: "url", baseBranch: "test" }],
    };
    const thread = createMockThread(threadState);

    const result = await resolvePRState(thread);
    expect(result).toEqual(threadState);
    expect(mockGetPRState).not.toHaveBeenCalled();
  });

  it("falls back to shared PR state when thread state is null", async () => {
    const thread = createMockThread(null);
    const prState = {
      status: "pr_created",

      branch: "agent/fix",
      repo: "recoupable/api",
      prs: [{ repo: "recoupable/api", number: 1, url: "url", baseBranch: "test" }],
    };
    mockGetPRState.mockResolvedValue(prState);

    const result = await resolvePRState(thread, { repo: "recoupable/api", branch: "agent/fix" });

    expect(mockGetPRState).toHaveBeenCalledWith("recoupable/api", "agent/fix");
    expect(result).toEqual({
      status: "pr_created",
      prompt: "",
      branch: "agent/fix",

      prs: prState.prs,
    });
  });

  it("returns null when neither thread state nor PR context exists", async () => {
    const thread = createMockThread(null);
    const result = await resolvePRState(thread);
    expect(result).toBeNull();
  });

  it("returns null when PR context has no match in Redis", async () => {
    const thread = createMockThread(null);
    mockGetPRState.mockResolvedValue(null);

    const result = await resolvePRState(thread, { repo: "recoupable/api", branch: "agent/fix" });
    expect(result).toBeNull();
  });

  it("ignores PR context when thread state exists", async () => {
    const threadState = { status: "running", prompt: "fix bug" };
    const thread = createMockThread(threadState);

    const result = await resolvePRState(thread, { repo: "recoupable/api", branch: "agent/fix" });
    expect(result).toEqual(threadState);
    expect(mockGetPRState).not.toHaveBeenCalled();
  });
});
