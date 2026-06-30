import { describe, it, expect, vi, beforeEach } from "vitest";
import { deliverEmail } from "../deliverEmail";
import type { ValidatedSendEmailRequest } from "../validateSendEmailBody";

const mockProcessAndSendEmail = vi.fn();
vi.mock("@/lib/emails/processAndSendEmail", () => ({
  processAndSendEmail: (...args: unknown[]) => mockProcessAndSendEmail(...args),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const data: ValidatedSendEmailRequest = {
  to: ["dest@example.com"],
  cc: ["cc@example.com"],
  subject: "Weekly report",
  text: "body",
  chat_id: "chat-1",
  accountId: "account-123",
};

describe("deliverEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a 200 + sent attempt and maps chat_id to room_id on success", async () => {
    mockProcessAndSendEmail.mockResolvedValue({ success: true, message: "ok", id: "re_1" });
    const { response, attempt } = await deliverEmail(data);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, message: "ok", id: "re_1" });
    expect(mockProcessAndSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["dest@example.com"], room_id: "chat-1" }),
    );
    expect(attempt).toEqual({
      status: "sent",
      accountId: "account-123",
      chatId: "chat-1",
      resendId: "re_1",
    });
  });

  it("returns a 502 + send_failed attempt (no resendId) on delivery failure", async () => {
    mockProcessAndSendEmail.mockResolvedValue({ success: false, error: "resend boom" });
    const { response, attempt } = await deliverEmail(data);

    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("resend boom");
    expect(attempt).toEqual({ status: "send_failed", accountId: "account-123", chatId: "chat-1" });
  });
});
