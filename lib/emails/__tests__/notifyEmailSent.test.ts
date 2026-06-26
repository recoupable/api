import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyEmailSent } from "../notifyEmailSent";

const mockSendMessage = vi.fn();
vi.mock("@/lib/telegram/sendMessage", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

describe("notifyEmailSent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts a Markdown message with the email details", async () => {
    await notifyEmailSent({
      accountId: "acct-1",
      to: ["dest@example.com"],
      cc: ["cc@example.com"],
      subject: "Weekly report",
      resendId: "resend-123",
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const [message, options] = mockSendMessage.mock.calls[0];
    expect(options).toEqual({ parse_mode: "Markdown" });
    expect(message).toContain("acct-1");
    expect(message).toContain("dest@example.com");
    expect(message).toContain("cc@example.com");
    expect(message).toContain("Weekly report");
    expect(message).toContain("resend-123");
  });

  it("omits the CC line when there is no cc", async () => {
    await notifyEmailSent({
      accountId: "acct-1",
      to: ["dest@example.com"],
      subject: "Hi",
      resendId: "r-1",
    });
    const [message] = mockSendMessage.mock.calls[0];
    expect(message).not.toContain("*CC:*");
  });

  it("never throws when Telegram fails (best-effort)", async () => {
    mockSendMessage.mockRejectedValue(new Error("telegram down"));
    await expect(
      notifyEmailSent({ accountId: "a", to: ["x@y.com"], subject: "s", resendId: "r" }),
    ).resolves.toBeUndefined();
  });
});
