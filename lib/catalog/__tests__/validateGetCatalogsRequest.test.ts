import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetCatalogsRequest } from "../validateGetCatalogsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { checkAccountAccess } from "@/lib/accounts/checkAccountAccess";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({
  selectAccounts: vi.fn(),
}));

vi.mock("@/lib/accounts/checkAccountAccess", () => ({
  checkAccountAccess: vi.fn(),
}));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const requesterId = "660e8400-e29b-41d4-a716-446655440000";
const makeRequest = (id = accountId) =>
  new NextRequest(`http://localhost/api/accounts/${id}/catalogs`, {
    method: "GET",
    headers: { Authorization: "Bearer test-token" },
  });

describe("validateGetCatalogsRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["not-a-uuid", "non-UUID id"],
    ["", "empty id"],
  ])("returns 400 for %s (%s)", async id => {
    const result = await validateGetCatalogsRequest(makeRequest(), id);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns the auth error when authentication fails", async () => {
    const authError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authError);

    const result = await validateGetCatalogsRequest(makeRequest(), accountId);

    expect(result).toBe(authError);
    expect(selectAccounts).not.toHaveBeenCalled();
  });

  it("returns 404 when the account does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: requesterId,
      authToken: "t",
      orgId: null,
    });
    vi.mocked(selectAccounts).mockResolvedValue([]);

    const result = await validateGetCatalogsRequest(makeRequest(), accountId);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
    expect(checkAccountAccess).not.toHaveBeenCalled();
  });

  it("returns 403 when the requester cannot access the account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: requesterId,
      authToken: "t",
      orgId: null,
    });
    vi.mocked(selectAccounts).mockResolvedValue([{ id: accountId }] as never);
    vi.mocked(checkAccountAccess).mockResolvedValue(false);

    const result = await validateGetCatalogsRequest(makeRequest(), accountId);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns the validated accountId on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: requesterId,
      authToken: "t",
      orgId: null,
    });
    vi.mocked(selectAccounts).mockResolvedValue([{ id: accountId }] as never);
    vi.mocked(checkAccountAccess).mockResolvedValue(true);

    const result = await validateGetCatalogsRequest(makeRequest(), accountId);

    expect(result).toEqual({ accountId });
    expect(checkAccountAccess).toHaveBeenCalledWith(requesterId, accountId);
  });
});
