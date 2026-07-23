import { describe, it, expect, vi, beforeEach } from "vitest";
import { alertZombieOwner } from "@/lib/chat/runs/alertZombieOwner";
import { getLatestUserMessageAt } from "@/lib/supabase/chat_messages/getLatestUserMessageAt";
import { markZombieOwnerAlerted } from "@/lib/chat/runs/markZombieOwnerAlerted";
import { sendMessage } from "@/lib/telegram/sendMessage";

vi.mock("@/lib/supabase/chat_messages/getLatestUserMessageAt", () => ({
  getLatestUserMessageAt: vi.fn(),
}));
vi.mock("@/lib/chat/runs/markZombieOwnerAlerted", () => ({
  markZombieOwnerAlerted: vi.fn(),
}));
vi.mock("@/lib/telegram/sendMessage", () => ({
  sendMessage: vi.fn(),
}));

const OLD = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
const RECENT = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

describe("alertZombieOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(markZombieOwnerAlerted).mockResolvedValue(true);
    vi.mocked(sendMessage).mockResolvedValue({} as never);
  });

  it("alerts when the owner's last user message is older than 45 days", async () => {
    vi.mocked(getLatestUserMessageAt).mockResolvedValue(OLD);

    await alertZombieOwner({ accountId: "acc-1", chatId: "chat-1", sessionId: "sess-1" });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const text = vi.mocked(sendMessage).mock.calls[0]?.[0] as string;
    expect(text).toContain("acc-1");
  });

  it("alerts when the owner has never sent a user message", async () => {
    vi.mocked(getLatestUserMessageAt).mockResolvedValue(null);

    await alertZombieOwner({ accountId: "acc-1", chatId: "chat-1", sessionId: "sess-1" });

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("does NOT alert when the owner is still active", async () => {
    vi.mocked(getLatestUserMessageAt).mockResolvedValue(RECENT);

    await alertZombieOwner({ accountId: "acc-1", chatId: "chat-1", sessionId: "sess-1" });

    expect(markZombieOwnerAlerted).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("dedupes — skips the send when the marker was already claimed", async () => {
    vi.mocked(getLatestUserMessageAt).mockResolvedValue(OLD);
    vi.mocked(markZombieOwnerAlerted).mockResolvedValue(false);

    await alertZombieOwner({ accountId: "acc-1", chatId: "chat-1", sessionId: "sess-1" });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("never throws when a dependency fails (must not break the run)", async () => {
    vi.mocked(getLatestUserMessageAt).mockRejectedValue(new Error("db down"));

    await expect(
      alertZombieOwner({ accountId: "acc-1", chatId: "chat-1", sessionId: "sess-1" }),
    ).resolves.toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
