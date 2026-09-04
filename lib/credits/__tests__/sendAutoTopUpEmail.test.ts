import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendAutoTopUpEmail } from "@/lib/credits/sendAutoTopUpEmail";

const { selectEmailsMock, sendMock } = vi.hoisted(() => ({
  selectEmailsMock: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: selectEmailsMock,
}));
vi.mock("@/lib/emails/sendEmail", () => ({ sendEmailWithResend: sendMock }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  vi.clearAllMocks();
  selectEmailsMock.mockResolvedValue([{ account_id: ACCOUNT, email: "nicole@example.com" }]);
  sendMock.mockResolvedValue({ id: "email_1" });
});

describe("sendAutoTopUpEmail", () => {
  it("sends a receipt with the amount to the account's email", async () => {
    await sendAutoTopUpEmail({ accountId: ACCOUNT, kind: "receipt", amountCents: 10000 });

    expect(selectEmailsMock).toHaveBeenCalledWith({ accountIds: ACCOUNT });
    const payload = sendMock.mock.calls[0][0];
    expect(payload.to).toBe("nicole@example.com");
    expect(payload.subject).toContain("$100.00");
    expect(payload.html).toContain("$100.00");
    expect(payload.html).not.toContain("—");
  });

  it("sends a decline notice that says auto top-up is now off and carries Stripe's message", async () => {
    await sendAutoTopUpEmail({
      accountId: ACCOUNT,
      kind: "declined",
      amountCents: 10000,
      message: "Your card was declined.",
    });

    const payload = sendMock.mock.calls[0][0];
    expect(payload.subject.toLowerCase()).toContain("auto top-up");
    expect(payload.html).toContain("Your card was declined.");
    expect(payload.html).toContain("turned off");
    expect(payload.html).toContain("/billing");
  });

  it("does nothing when the account has no email", async () => {
    selectEmailsMock.mockResolvedValue([]);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await sendAutoTopUpEmail({ accountId: ACCOUNT, kind: "receipt", amountCents: 500 });

    expect(sendMock).not.toHaveBeenCalled();
  });
});
