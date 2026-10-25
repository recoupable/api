import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "../route";
import { RECOUP_ORG_ID } from "@/lib/const";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectAccountSandboxes } from "@/lib/supabase/account_sandboxes/selectAccountSandboxes";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));
vi.mock("@/lib/supabase/account_sandboxes/selectAccountSandboxes", () => ({
  selectAccountSandboxes: vi.fn(),
}));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({ default: vi.fn() }));
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({ selectAccounts: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const ADMIN = "11111111-1111-4111-8111-111111111111";
const request = () => new NextRequest("https://synthetic.invalid/api/admins/sandboxes");
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: ADMIN,
    orgId: null,
    authToken: "synthetic",
  });
  vi.mocked(getAccountOrganizations).mockResolvedValue([
    { account_id: ADMIN, organization_id: RECOUP_ORG_ID },
  ] as never);
  vi.mocked(selectAccountSandboxes).mockResolvedValue([
    { account_id: "account-b", created_at: "2026-03-11T00:00:00Z" },
    { account_id: "account-a", created_at: "2026-03-10T00:00:00Z" },
    { account_id: "account-b", created_at: "2026-03-09T00:00:00Z" },
  ] as never);
  vi.mocked(selectAccountEmails).mockResolvedValue([
    { account_id: "account-a", email: "a@example.invalid" },
    { account_id: "account-b", email: "b@example.invalid" },
  ] as never);
  vi.mocked(selectAccounts).mockResolvedValue([
    { id: "account-a", name: "Account A", timestamp: null },
    { id: "account-b", name: "Account B", timestamp: null },
  ]);
});

describe("admin sandbox account names through the actual route", () => {
  it.each([401, 403])("rejects %s before reading sandboxes, names or emails", async status => {
    if (status === 401) {
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
      );
    } else {
      vi.mocked(getAccountOrganizations).mockResolvedValue([]);
    }
    const response = await GET(request());
    expect(response.status).toBe(status);
    expect(selectAccountSandboxes).not.toHaveBeenCalled();
    expect(selectAccounts).not.toHaveBeenCalled();
    expect(selectAccountEmails).not.toHaveBeenCalled();
    if (status === 401) expect(getAccountOrganizations).not.toHaveBeenCalled();
  });

  it("adds real names by ID in one batch, preserving emails, counts and descending order", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "success",
      accounts: [
        {
          account_id: "account-b",
          account_name: "Account B",
          account_email: "b@example.invalid",
          total_sandboxes: 2,
          last_created_at: "2026-03-11T00:00:00Z",
        },
        {
          account_id: "account-a",
          account_name: "Account A",
          account_email: "a@example.invalid",
          total_sandboxes: 1,
          last_created_at: "2026-03-10T00:00:00Z",
        },
      ],
    });
    expect(getAccountOrganizations).toHaveBeenCalledExactlyOnceWith({
      accountId: ADMIN,
      organizationId: RECOUP_ORG_ID,
    });
    expect(selectAccounts).toHaveBeenCalledExactlyOnceWith(["account-b", "account-a"]);
    expect(selectAccountEmails).toHaveBeenCalledExactlyOnceWith({
      accountIds: ["account-b", "account-a"],
    });
    expect(vi.mocked(getAccountOrganizations).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(selectAccountSandboxes).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(selectAccountSandboxes).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(selectAccounts).mock.invocationCallOrder[0],
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it.each([
    { found: false, name: null },
    { found: true, name: null },
    { found: true, name: "" },
  ])("does not invent an email fallback for name $name / found $found", async ({ found, name }) => {
    vi.mocked(selectAccounts).mockResolvedValue(
      found ? [{ id: "account-b", name, timestamp: null }] : [],
    );
    const response = await GET(request());
    const body = await response.json();
    expect(body.accounts[0].account_name).toBe(found ? name : null);
    expect(body.accounts[0].account_email).toBe("b@example.invalid");
    expect(body.accounts[1].account_name).toBeNull();
  });

  it("keeps email null independently when the account has a name but no email", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([]);
    const response = await GET(request());
    const body = await response.json();
    expect(body.accounts[0]).toMatchObject({ account_name: "Account B", account_email: null });
  });

  it("skips both batches when there are no sandbox accounts", async () => {
    vi.mocked(selectAccountSandboxes).mockResolvedValue([]);
    const response = await GET(request());
    expect(await response.json()).toEqual({ status: "success", accounts: [] });
    expect(selectAccounts).not.toHaveBeenCalled();
    expect(selectAccountEmails).not.toHaveBeenCalled();
  });

  it("propagates a failed name read as the existing typed 500, not missing names", async () => {
    vi.mocked(selectAccounts).mockRejectedValue(new Error("synthetic private database failure"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error", message: "Internal server error" });
  });

  it("retains the thrown aggregation failure path before account enrichment", async () => {
    vi.mocked(selectAccountSandboxes).mockRejectedValue(
      new Error("synthetic unavailable sandboxes"),
    );
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(selectAccounts).not.toHaveBeenCalled();
    expect(selectAccountEmails).not.toHaveBeenCalled();
  });
});
