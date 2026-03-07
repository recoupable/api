import { describe, it, expect, vi } from "vitest";

const mockThread = {
  post: vi.fn(),
  setState: vi.fn(),
};

vi.mock("../getThread", () => ({
  getThread: vi.fn(() => mockThread),
}));

vi.mock("chat", () => ({
  Card: vi.fn(opts => ({ type: "card", ...opts })),
  CardText: vi.fn(text => ({ type: "text", text })),
  Actions: vi.fn(children => ({ type: "actions", children })),
  Button: vi.fn(opts => ({ type: "button", ...opts })),
  LinkButton: vi.fn(opts => ({ type: "link-button", ...opts })),
}));

const mockSetPRState = vi.fn();
vi.mock("../prState", () => ({
  setCodingAgentPRState: (...args: unknown[]) => mockSetPRState(...args),
}));

describe("handlePRCreated", () => {
  it("posts a card with PR links and merge button", async () => {
    const { handlePRCreated } = await import("../handlePRCreated");

    await handlePRCreated("slack:C123:ts", {
      threadId: "slack:C123:ts",
      status: "pr_created",
      branch: "agent/fix-bug",
      snapshotId: "snap_abc",
      prs: [
        {
          repo: "recoupable/api",
          number: 42,
          url: "https://github.com/recoupable/api/pull/42",
          baseBranch: "test",
        },
      ],
    });

    expect(mockThread.post).toHaveBeenCalledWith(
      expect.objectContaining({ card: expect.anything() }),
    );

    const { Button } = await import("chat");
    expect(Button).toHaveBeenCalledWith(
      expect.objectContaining({ id: "merge_all_prs", label: "Merge All PRs" }),
    );

    expect(mockThread.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pr_created",
        branch: "agent/fix-bug",
        snapshotId: "snap_abc",
      }),
    );

    expect(mockSetPRState).toHaveBeenCalledWith(
      "recoupable/api",
      "agent/fix-bug",
      expect.objectContaining({
        status: "pr_created",
        snapshotId: "snap_abc",
        branch: "agent/fix-bug",
        repo: "recoupable/api",
      }),
    );
  });
});
