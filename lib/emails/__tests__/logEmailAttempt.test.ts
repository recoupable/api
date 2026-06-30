import { describe, it, expect, vi, beforeEach } from "vitest";

import { logEmailAttempt } from "../logEmailAttempt";

const mockInsert = vi.fn();
vi.mock("@/lib/supabase/email_send_log/insertEmailSendLog", () => ({
  insertEmailSendLog: (...args: unknown[]) => mockInsert(...args),
}));

describe("logEmailAttempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("records a sent attempt with parsed body, lengths, and resend id", async () => {
    await logEmailAttempt({
      rawBody: JSON.stringify({ to: ["a@b.com"], html: "<p>hi</p>" }),
      status: "sent",
      accountId: "acc-1",
      to: ["a@b.com"],
      subject: "S",
      html: "<p>hi</p>",
      chatId: "chat-1",
      resendId: "re_123",
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0][0];
    expect(row.status).toBe("sent");
    expect(row.body_parsed).toBe(true);
    expect(row.account_id).toBe("acc-1");
    expect(row.to_count).toBe(1);
    expect(row.html_length).toBe("<p>hi</p>".length);
    expect(row.resend_id).toBe("re_123");
    expect(row.chat_id).toBe("chat-1");
  });

  it("marks body_parsed false for a malformed body and still logs", async () => {
    await logEmailAttempt({ rawBody: '{"to":[', status: "rejected" });
    const row = mockInsert.mock.calls[0][0];
    expect(row.body_parsed).toBe(false);
    expect(row.status).toBe("rejected");
    expect(row.account_id).toBeNull();
  });

  it("truncates a large raw body to 10000 chars", async () => {
    await logEmailAttempt({ rawBody: "x".repeat(20000), status: "rejected" });
    const row = mockInsert.mock.calls[0][0];
    expect(row.raw_body.length).toBe(10000);
  });

  it("never throws when the insert fails", async () => {
    mockInsert.mockRejectedValue(new Error("db down"));
    await expect(logEmailAttempt({ rawBody: "{}", status: "rejected" })).resolves.toBeUndefined();
  });
});
