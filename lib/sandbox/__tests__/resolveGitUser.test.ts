import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveGitUser } from "@/lib/sandbox/resolveGitUser";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: vi.fn(),
}));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

const ACCOUNT_ID = "11111111-2222-3333-4444-555555555555";

describe("resolveGitUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the account's name and email when both are populated", async () => {
    vi.mocked(selectAccounts).mockResolvedValueOnce([
      { id: ACCOUNT_ID, name: "Ada Lovelace", timestamp: null },
    ] as never);
    vi.mocked(selectAccountEmails).mockResolvedValueOnce([
      { id: "e1", account_id: ACCOUNT_ID, email: "ada@example.com", updated_at: "" },
    ] as never);

    const gitUser = await resolveGitUser(ACCOUNT_ID);

    expect(gitUser).toEqual({ name: "Ada Lovelace", email: "ada@example.com" });
  });

  it("falls back to a stable synthetic name when the account has no name", async () => {
    vi.mocked(selectAccounts).mockResolvedValueOnce([
      { id: ACCOUNT_ID, name: null, timestamp: null },
    ] as never);
    vi.mocked(selectAccountEmails).mockResolvedValueOnce([
      { id: "e1", account_id: ACCOUNT_ID, email: "ada@example.com", updated_at: "" },
    ] as never);

    const gitUser = await resolveGitUser(ACCOUNT_ID);

    expect(gitUser.name).toBe(`recoupable-${ACCOUNT_ID.slice(0, 8)}`);
    expect(gitUser.email).toBe("ada@example.com");
  });

  it("falls back to a noreply email when no account_emails row exists", async () => {
    vi.mocked(selectAccounts).mockResolvedValueOnce([
      { id: ACCOUNT_ID, name: "Ada Lovelace", timestamp: null },
    ] as never);
    vi.mocked(selectAccountEmails).mockResolvedValueOnce([] as never);

    const gitUser = await resolveGitUser(ACCOUNT_ID);

    expect(gitUser.name).toBe("Ada Lovelace");
    expect(gitUser.email).toBe(`${ACCOUNT_ID}@users.noreply.recoupable.dev`);
  });

  it("falls back on both fields when nothing is on file", async () => {
    vi.mocked(selectAccounts).mockResolvedValueOnce([] as never);
    vi.mocked(selectAccountEmails).mockResolvedValueOnce([] as never);

    const gitUser = await resolveGitUser(ACCOUNT_ID);

    expect(gitUser).toEqual({
      name: `recoupable-${ACCOUNT_ID.slice(0, 8)}`,
      email: `${ACCOUNT_ID}@users.noreply.recoupable.dev`,
    });
  });

  it("ignores account_emails rows where email is null", async () => {
    vi.mocked(selectAccounts).mockResolvedValueOnce([
      { id: ACCOUNT_ID, name: "Ada Lovelace", timestamp: null },
    ] as never);
    vi.mocked(selectAccountEmails).mockResolvedValueOnce([
      { id: "e1", account_id: ACCOUNT_ID, email: null, updated_at: "" },
    ] as never);

    const gitUser = await resolveGitUser(ACCOUNT_ID);

    expect(gitUser.email).toBe(`${ACCOUNT_ID}@users.noreply.recoupable.dev`);
  });
});
