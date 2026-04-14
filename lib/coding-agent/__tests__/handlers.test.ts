import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTriggerCodingAgent = vi.fn().mockResolvedValue({ id: "run_123" });
const mockTriggerUpdatePR = vi.fn().mockResolvedValue({ id: "run_456" });

vi.mock("@/lib/trigger/triggerCodingAgent", () => ({
  triggerCodingAgent: mockTriggerCodingAgent,
}));

vi.mock("@/lib/trigger/triggerUpdatePR", () => ({
  triggerUpdatePR: mockTriggerUpdatePR,
}));

vi.mock("chat", () => ({
  Card: vi.fn(opts => ({ type: "card", ...opts })),
  CardText: vi.fn(text => ({ type: "text", text })),
  Actions: vi.fn(children => ({ type: "actions", children })),
  LinkButton: vi.fn(opts => ({ type: "link-button", ...opts })),
}));

vi.mock("../prState", () => ({
  getCodingAgentPRState: vi.fn().mockResolvedValue(null),
  setCodingAgentPRState: vi.fn(),
}));

const { registerOnNewMention } = await import("../handlers/onNewMention");

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Create Mock Bot.
 *
 * @returns - Result.
 */
function createMockBot() {
  return {
    onNewMention: vi.fn(),
  } as unknown;
}

describe("registerOnNewMention", () => {
  it("registers a handler on the bot", () => {
    const bot = createMockBot();
    registerOnNewMention(bot);
    expect(bot.onNewMention).toHaveBeenCalledOnce();
  });

  it("posts acknowledgment and triggers coding agent task when no existing state", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot);
    const handler = bot.onNewMention.mock.calls[0][0];

    const mockThread = {
      id: "slack:C123:1234567890.123456",
      state: Promise.resolve(null),
      subscribe: vi.fn(),
      post: vi.fn(),
      setState: vi.fn(),
    };
    const mockMessage = {
      text: "fix the login bug in the api",
      author: { id: "U111" },
    };

    await handler(mockThread, mockMessage);

    expect(mockThread.subscribe).toHaveBeenCalledOnce();
    expect(mockTriggerCodingAgent).toHaveBeenCalled();
    expect(mockThread.post).toHaveBeenCalledWith(
      expect.objectContaining({ card: expect.anything() }),
    );
    expect(mockThread.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "running",
        prompt: "fix the login bug in the api",
      }),
    );
  });

  it("triggers update-pr instead of coding-agent when thread has pr_created state", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot);
    const handler = bot.onNewMention.mock.calls[0][0];

    const mockThread = {
      id: "github:recoupable/tasks:56",
      state: Promise.resolve({
        status: "pr_created",
        prompt: "original prompt",
        snapshotId: "snap_abc",
        branch: "agent/fix-bug",
        prs: [
          {
            repo: "recoupable/tasks",
            number: 56,
            url: "https://github.com/recoupable/tasks/pull/56",
            baseBranch: "main",
          },
        ],
      }),
      subscribe: vi.fn(),
      post: vi.fn(),
      setState: vi.fn(),
    };
    const mockMessage = {
      text: "remove the Project Structure changes",
      author: { id: "sweetmantech" },
    };

    await handler(mockThread, mockMessage);

    expect(mockTriggerCodingAgent).not.toHaveBeenCalled();
    expect(mockTriggerUpdatePR).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: "remove the Project Structure changes",
        snapshotId: "snap_abc",
        branch: "agent/fix-bug",
        repo: "recoupable/tasks",
      }),
    );
    expect(mockThread.post).toHaveBeenCalledWith(
      expect.objectContaining({ card: expect.anything() }),
    );
    expect(mockThread.setState).toHaveBeenCalledWith(
      expect.objectContaining({ status: "updating" }),
    );
  });

  it("resolves PR state from shared key when thread state is null and raw has repo/branch", async () => {
    const { getCodingAgentPRState } = await import("../prState");
    vi.mocked(getCodingAgentPRState).mockResolvedValue({
      status: "pr_created",
      snapshotId: "snap_abc",
      branch: "agent/fix-bug",
      repo: "recoupable/api",
      prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
    });

    const bot = createMockBot();
    registerOnNewMention(bot);
    const handler = bot.onNewMention.mock.calls[0][0];

    const mockThread = {
      id: "github:recoupable/api:42",
      state: Promise.resolve(null),
      subscribe: vi.fn(),
      post: vi.fn(),
      setState: vi.fn(),
    };
    const mockMessage = {
      text: "make the button blue",
      author: { id: "sweetmantech" },
      raw: { repo: "recoupable/api", branch: "agent/fix-bug" },
    };

    await handler(mockThread, mockMessage);

    expect(getCodingAgentPRState).toHaveBeenCalledWith("recoupable/api", "agent/fix-bug");
    expect(mockTriggerUpdatePR).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: "make the button blue",
        snapshotId: "snap_abc",
        branch: "agent/fix-bug",
        repo: "recoupable/api",
      }),
    );
    expect(mockTriggerCodingAgent).not.toHaveBeenCalled();
  });

  it("tells user to wait when thread is already running", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot);
    const handler = bot.onNewMention.mock.calls[0][0];

    const mockThread = {
      id: "github:recoupable/tasks:56",
      state: Promise.resolve({ status: "running", prompt: "original" }),
      subscribe: vi.fn(),
      post: vi.fn(),
      setState: vi.fn(),
    };
    const mockMessage = { text: "any update?", author: { id: "sweetmantech" } };

    await handler(mockThread, mockMessage);

    expect(mockTriggerCodingAgent).not.toHaveBeenCalled();
    expect(mockTriggerUpdatePR).not.toHaveBeenCalled();
    expect(mockThread.post).toHaveBeenCalledWith(expect.stringContaining("still working"));
  });
});
