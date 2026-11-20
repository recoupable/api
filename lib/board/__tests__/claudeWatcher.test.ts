import { describe, it, expect, vi, beforeEach } from "vitest";

import { claudeWatcher } from "@/lib/board/claudeWatcher";
import { startClaudeForBoardTask } from "@/lib/board/startClaudeForBoardTask";
import { getClaudeTaskToStart } from "@/lib/board/getClaudeTaskToStart";

vi.mock("@/lib/board/startClaudeForBoardTask", () => ({
  startClaudeForBoardTask: vi.fn(),
}));
vi.mock("@/lib/board/getTrustedBoardPrincipals", () => ({
  getTrustedBoardPrincipals: vi.fn(() => ["vercel:user:trusted"]),
}));
vi.mock("@/lib/board/getClaudeTaskToStart", () => ({
  getClaudeTaskToStart: vi.fn(),
}));

describe("claudeWatcher", () => {
  const board = { as: vi.fn() } as never;
  const event = { type: "task.created" } as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tails threads labeled agent=claude", () => {
    expect(claudeWatcher.tail).toBe("--label agent=claude");
  });

  it("starts Claude for a task the filter accepts", async () => {
    vi.mocked(getClaudeTaskToStart).mockReturnValue({ id: "812", channel: "general" });
    await claudeWatcher.run({ event, board });
    expect(getClaudeTaskToStart).toHaveBeenCalledWith(event, ["vercel:user:trusted"]);
    expect(startClaudeForBoardTask).toHaveBeenCalledWith({
      board,
      task: { id: "812", channel: "general" },
    });
  });

  it("does nothing for an event the filter rejects", async () => {
    vi.mocked(getClaudeTaskToStart).mockReturnValue(null);
    await claudeWatcher.run({ event, board });
    expect(startClaudeForBoardTask).not.toHaveBeenCalled();
  });
});
