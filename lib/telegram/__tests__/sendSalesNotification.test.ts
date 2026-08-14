import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { sendMessageMock, isTestEmailMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  isTestEmailMock: vi.fn(),
}));

vi.mock("@/lib/telegram/sendMessage", () => ({ sendMessage: sendMessageMock }));
vi.mock("@/lib/emails/isTestEmail", () => ({ isTestEmail: isTestEmailMock }));

const { sendSalesNotification } = await import("@/lib/telegram/sendSalesNotification");

describe("sendSalesNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTestEmailMock.mockReturnValue(false);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("sends the text via the Telegram sendMessage primitive", async () => {
    await sendSalesNotification({ email: "fan@example.com", text: "💸 hello" });
    expect(sendMessageMock).toHaveBeenCalledWith("💸 hello");
  });

  it("skips test emails", async () => {
    isTestEmailMock.mockReturnValue(true);
    await sendSalesNotification({ email: "sweetmantech@gmail.com", text: "x" });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("still sends when the email is unknown (null)", async () => {
    await sendSalesNotification({ email: null, text: "x" });
    expect(sendMessageMock).toHaveBeenCalledWith("x");
    expect(isTestEmailMock).not.toHaveBeenCalled();
  });

  it("never throws when Telegram fails — logs instead", async () => {
    sendMessageMock.mockRejectedValue(new Error("telegram down"));
    await expect(
      sendSalesNotification({ email: "fan@example.com", text: "x" }),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
