import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildRunAgentInput } from "@/lib/chat/buildRunAgentInput";
import { parseGitHubRepoIdentifiers } from "@/lib/github/parseGitHubRepoIdentifiers";
import { extractOrgId } from "@/lib/recoupable/extractOrgId";

vi.mock("@/lib/github/parseGitHubRepoIdentifiers", () => ({
  parseGitHubRepoIdentifiers: vi.fn(() => ({ owner: "o", repo: "r" })),
}));
vi.mock("@/lib/recoupable/extractOrgId", () => ({
  extractOrgId: vi.fn(() => "org-1"),
}));

const base = {
  messages: [{ id: "m1", role: "user", parts: [] }] as never,
  chatId: "chat-1",
  sessionId: "sess-1",
  accountId: "acc-1",
  modelId: "anthropic/claude-haiku-4.5",
  sessionTitle: "Weekly report",
  cloneUrl: "https://github.com/o/r.git",
  sandboxState: { type: "vercel", sandboxName: "sb-1" } as never,
  workingDirectory: "/work",
  skills: [] as never,
};

describe("buildRunAgentInput", () => {
  beforeEach(() => vi.clearAllMocks());

  it("assembles the workflow input, deriving repo ids + org id from cloneUrl", () => {
    const input = buildRunAgentInput(base);
    expect(input.chatId).toBe("chat-1");
    expect(input.sessionId).toBe("sess-1");
    expect(input.accountId).toBe("acc-1");
    expect(input.modelId).toBe("anthropic/claude-haiku-4.5");
    expect(input.sessionTitle).toBe("Weekly report");
    expect(input.repoOwner).toBe("o");
    expect(input.repoName).toBe("r");
    expect(input.agentContext.recoupOrgId).toBe("org-1");
    expect(input.agentContext.sandbox).toEqual({
      state: { type: "vercel", sandboxName: "sb-1" },
      workingDirectory: "/work",
    });
  });

  it("includes recoupAccessToken when provided", () => {
    const input = buildRunAgentInput({ ...base, recoupAccessToken: "tok-123" });
    expect(input.agentContext.recoupAccessToken).toBe("tok-123");
  });

  it("omits recoupAccessToken entirely when absent", () => {
    const input = buildRunAgentInput(base);
    expect("recoupAccessToken" in input.agentContext).toBe(false);
  });

  it("leaves recoupOrgId undefined when cloneUrl is null (no org derivation)", () => {
    const input = buildRunAgentInput({ ...base, cloneUrl: null });
    expect(input.agentContext.recoupOrgId).toBeUndefined();
    expect(extractOrgId).not.toHaveBeenCalled();
    expect(parseGitHubRepoIdentifiers).toHaveBeenCalledWith(null);
  });
});
