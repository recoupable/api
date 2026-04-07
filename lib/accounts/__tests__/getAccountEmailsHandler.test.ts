import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAccountEmailsHandler } from "../getAccountEmailsHandler";
import { validateGetAccountEmailsQuery } from "../validateGetAccountEmailsQuery";
import { checkAccountAccess } from "@/lib/auth/checkAccountAccess";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateGetAccountEmailsQuery", () => ({
  validateGetAccountEmailsQuery: vi.fn(),
}));

vi.mock("@/lib/auth/checkAccountAccess", () => ({
  checkAccountAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

function createMockRequest(): NextRequest {
  return {
    url: "http://localhost:3000/api/accounts/emails",
    nextUrl: new URL("http://localhost:3000/api/accounts/emails"),
    headers: new Headers({ authorization: "Bearer test-token" }),
  } as unknown as NextRequest;
}

describe("getAccountEmailsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validation response errors directly", async () => {
    vi.mocked(validateGetAccountEmailsQuery).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await getAccountEmailsHandler(createMockRequest());

    expect(result.status).toBe(401);
  });

  it("returns an empty array when no account IDs are provided", async () => {
    vi.mocked(validateGetAccountEmailsQuery).mockResolvedValue({
      authenticatedAccountId: "account-123",
      accountIds: [],
    });

    const result = await getAccountEmailsHandler(createMockRequest());

    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toEqual([]);
    expect(checkAccountAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when any requested account is unauthorized", async () => {
    vi.mocked(validateGetAccountEmailsQuery).mockResolvedValue({
      authenticatedAccountId: "account-123",
      accountIds: ["acc-1", "acc-2"],
    });
    vi.mocked(checkAccountAccess)
      .mockResolvedValueOnce({ hasAccess: true, entityType: "self" })
      .mockResolvedValueOnce({ hasAccess: false });

    const result = await getAccountEmailsHandler(createMockRequest());

    expect(checkAccountAccess).toHaveBeenCalledWith("account-123", "acc-1");
    expect(checkAccountAccess).toHaveBeenCalledWith("account-123", "acc-2");
    expect(result.status).toBe(403);
    await expect(result.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(selectAccountEmails).not.toHaveBeenCalled();
  });

  it("returns raw account email rows when all requested accounts are authorized", async () => {
    const rows = [
      {
        id: "email-1",
        account_id: "acc-1",
        email: "owner@example.com",
        updated_at: "2026-04-08T00:00:00.000Z",
      },
    ];

    vi.mocked(validateGetAccountEmailsQuery).mockResolvedValue({
      authenticatedAccountId: "account-123",
      accountIds: ["acc-1", "acc-2"],
    });
    vi.mocked(checkAccountAccess).mockResolvedValue({ hasAccess: true, entityType: "artist" });
    vi.mocked(selectAccountEmails).mockResolvedValue(rows);

    const result = await getAccountEmailsHandler(createMockRequest());

    expect(selectAccountEmails).toHaveBeenCalledWith({ accountIds: ["acc-1", "acc-2"] });
    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toEqual(rows);
  });

  it("returns an empty array when account email lookup returns no rows", async () => {
    vi.mocked(validateGetAccountEmailsQuery).mockResolvedValue({
      authenticatedAccountId: "account-123",
      accountIds: ["acc-1"],
    });
    vi.mocked(checkAccountAccess).mockResolvedValue({ hasAccess: true, entityType: "self" });
    vi.mocked(selectAccountEmails).mockResolvedValue([]);

    const result = await getAccountEmailsHandler(createMockRequest());

    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toEqual([]);
  });
});
