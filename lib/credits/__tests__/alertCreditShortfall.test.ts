import { describe, it, expect, vi, beforeEach } from "vitest";
import { alertCreditShortfall } from "@/lib/credits/alertCreditShortfall";
import { sendMessage } from "@/lib/telegram/sendMessage";

vi.mock("@/lib/telegram/sendMessage", () => ({
  sendMessage: vi.fn(),
}));

describe("alertCreditShortfall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a Telegram alert naming the account and chat", async () => {
    vi.mocked(sendMessage).mockResolvedValue({} as never);

    await alertCreditShortfall({ accountId: "acc-1", chatId: "chat-9", sessionId: "sess-9" });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const text = vi.mocked(sendMessage).mock.calls[0]?.[0] as string;
    expect(text).toContain("acc-1");
    expect(text).toContain("chat-9");
  });

  it("never throws when Telegram send fails (alerting must not break the workflow)", async () => {
    vi.mocked(sendMessage).mockRejectedValue(new Error("telegram down"));

    await expect(
      alertCreditShortfall({ accountId: "acc-1", chatId: "chat-9", sessionId: "sess-9" }),
    ).resolves.toBeUndefined();
  });
});
