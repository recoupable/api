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

  it("records account, chat, status, resend id, and the raw body", async () => {
    const raw = JSON.stringify({ html: "<p>hi</p>" });
    await logEmailAttempt({
      rawBody: raw,
      status: "sent",
      accountId: "acc-1",
      chatId: "chat-1",
      resendId: "re_123",
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = mockInsert.mock.calls[0][0];
    expect(row.status).toBe("sent");
    expect(row.account_id).toBe("acc-1");
    expect(row.chat_id).toBe("chat-1");
    expect(row.resend_id).toBe("re_123");
    expect(row.raw_body).toBe(raw);
  });

  it("stores the full raw body (no truncation)", async () => {
    await logEmailAttempt({ rawBody: "x".repeat(20000), status: "rejected" });
    expect(mockInsert.mock.calls[0][0].raw_body.length).toBe(20000);
  });

  it("nulls optional ids and never throws when the insert fails", async () => {
    mockInsert.mockRejectedValue(new Error("db down"));
    await expect(logEmailAttempt({ rawBody: "{}", status: "rejected" })).resolves.toBeUndefined();
    const row = mockInsert.mock.calls[0][0];
    expect(row.account_id).toBeNull();
    expect(row.chat_id).toBeNull();
  });
});
