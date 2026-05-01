import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAccountEmailIds } from "../getAccountEmailIds";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { listResendEmails } from "@/lib/emails/listResendEmails";
import type { ListEmail } from "resend";

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/emails/listResendEmails", () => ({
  listResendEmails: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockListEmail: ListEmail = {
  id: "email-abc",
  from: "agent@recoupable.com",
  to: ["user@test.com"],
  cc: null,
  bcc: null,
  reply_to: null,
  subject: "Your Pulse",
  created_at: "2026-03-16T10:00:00Z",
  scheduled_at: null,
  last_event: "delivered",
};

describe("getAccountEmailIds", () => {
  it("returns email IDs for emails sent to the account's email", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValueOnce([
      { account_id: "acc-123", email: "user@test.com", id: "ae-1", updated_at: "" },
    ]);
    vi.mocked(listResendEmails).mockResolvedValueOnce([
      { ...mockListEmail, id: "email-1", to: ["user@test.com"] },
      { ...mockListEmail, id: "email-2", to: ["other@test.com"] },
      { ...mockListEmail, id: "email-3", to: ["user@test.com"] },
    ]);

    const result = await getAccountEmailIds("acc-123");

    expect(result).toEqual(["email-1", "email-3"]);
  });

  it("returns empty when account has no email address", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValueOnce([]);

    const result = await getAccountEmailIds("acc-123");

    expect(result).toEqual([]);
    expect(listResendEmails).not.toHaveBeenCalled();
  });

  it("returns empty when Resend returns no emails", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValueOnce([
      { account_id: "acc-123", email: "user@test.com", id: "ae-1", updated_at: "" },
    ]);
    vi.mocked(listResendEmails).mockResolvedValueOnce([]);

    const result = await getAccountEmailIds("acc-123");

    expect(result).toEqual([]);
  });
});
