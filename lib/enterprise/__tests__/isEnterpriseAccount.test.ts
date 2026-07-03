import { beforeEach, describe, expect, it, vi } from "vitest";

import { isEnterpriseAccount } from "@/lib/enterprise/isEnterpriseAccount";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

function emailRow(email: string | null) {
  return { account_id: ACCOUNT, email, id: "row-1" } as never;
}

describe("isEnterpriseAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when an account email's domain is in ENTERPRISE_DOMAINS", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([emailRow("artist@seekermusic.com")]);

    await expect(isEnterpriseAccount(ACCOUNT)).resolves.toBe(true);
    expect(selectAccountEmails).toHaveBeenCalledWith({ accountIds: ACCOUNT });
  });

  it("matches domains case-insensitively", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([emailRow("Artist@SeekerMusic.com")]);

    await expect(isEnterpriseAccount(ACCOUNT)).resolves.toBe(true);
  });

  it("returns true when any of multiple emails matches", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([
      emailRow("personal@gmail.com"),
      emailRow("work@rostrumrecords.com"),
    ]);

    await expect(isEnterpriseAccount(ACCOUNT)).resolves.toBe(true);
  });

  it("returns false when no email domain is enterprise", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([emailRow("someone@gmail.com")]);

    await expect(isEnterpriseAccount(ACCOUNT)).resolves.toBe(false);
  });

  it("returns false when the account has no emails", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    await expect(isEnterpriseAccount(ACCOUNT)).resolves.toBe(false);
  });

  it("returns false for rows with null or malformed emails", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([emailRow(null), emailRow("not-an-email")]);

    await expect(isEnterpriseAccount(ACCOUNT)).resolves.toBe(false);
  });
});
