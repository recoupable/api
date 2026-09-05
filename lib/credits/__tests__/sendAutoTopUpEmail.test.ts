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

  it("names the card that was charged when the caller passes it", async () => {
    await sendAutoTopUpEmail({
      accountId: ACCOUNT,
      kind: "receipt",
      amountCents: 500,
      card: { brand: "mastercard", last4: "3800" },
    });
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).toContain("your Mastercard ending in 3800");
    expect(html).toContain("$5.00");
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

  it("escapes markup in Stripe's decline message and links to the billing page", async () => {
    await sendAutoTopUpEmail({
      accountId: ACCOUNT,
      kind: "declined",
      amountCents: 500,
      message: "<img src=x onerror=alert(1)> & done",
    });
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt; &amp; done");
    expect(html).toContain("https://app.recoupable.dev/billing");
  });

  it("picks the most recently updated non-empty email when the account has several rows", async () => {
    selectEmailsMock.mockResolvedValue([
      { account_id: ACCOUNT, email: null, updated_at: "2026-09-05T00:00:00Z" },
      { account_id: ACCOUNT, email: "old@example.com", updated_at: "2026-01-01T00:00:00Z" },
      { account_id: ACCOUNT, email: "new@example.com", updated_at: "2026-08-01T00:00:00Z" },
    ]);
    await sendAutoTopUpEmail({ accountId: ACCOUNT, kind: "receipt", amountCents: 500 });
    expect(sendMock.mock.calls[0][0].to).toBe("new@example.com");
  });

  it("says the credits arrive via the webhook shortly, not that they were added", async () => {
    await sendAutoTopUpEmail({ accountId: ACCOUNT, kind: "receipt", amountCents: 10000 });
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html.toLowerCase()).toContain("shortly");
  });

  it("does nothing when the account has no email", async () => {
    selectEmailsMock.mockResolvedValue([]);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await sendAutoTopUpEmail({ accountId: ACCOUNT, kind: "receipt", amountCents: 500 });

    expect(sendMock).not.toHaveBeenCalled();
  });
});
