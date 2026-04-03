import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { getAccountHandler } from "@/lib/accounts/getAccountHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

vi.mock("@/lib/accounts/validateAccountParams", () => ({
  validateAccountParams: vi.fn((id: string) => {
    if (!uuidRe.test(id)) {
      return NextResponse.json(
        {
          status: "error",
          missing_fields: ["id"],
          error: "id must be a valid UUID",
        },
        { status: 400, headers: {} },
      );
    }
    return { id };
  }),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/getAccountWithDetails", () => ({
  getAccountWithDetails: vi.fn(),
}));

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("getAccountHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when id is not a valid UUID", async () => {
    const req = new NextRequest("http://localhost/api/accounts/not-a-uuid");
    const res = await getAccountHandler(req, Promise.resolve({ id: "not-a-uuid" }));
    expect(res.status).toBe(400);
    expect(validateAuthContext).not.toHaveBeenCalled();
    expect(getAccountWithDetails).not.toHaveBeenCalled();
  });

  it("returns auth error when validateAuthContext fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "unauthorized" }, { status: 401 }),
    );

    const req = new NextRequest("http://localhost/api/accounts/" + validUuid);
    const res = await getAccountHandler(req, Promise.resolve({ id: validUuid }));

    expect(res.status).toBe(401);
    expect(validateAuthContext).toHaveBeenCalledWith(req, { accountId: validUuid });
    expect(getAccountWithDetails).not.toHaveBeenCalled();
  });

  it("returns 404 when account is not found after successful auth", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: validUuid,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(getAccountWithDetails).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/accounts/" + validUuid);
    const res = await getAccountHandler(req, Promise.resolve({ id: validUuid }));

    expect(res.status).toBe(404);
    expect(getAccountWithDetails).toHaveBeenCalledWith(validUuid);
  });

  it("returns 200 with account when authorized and found", async () => {
    const account = { id: validUuid, name: "Test" };
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: validUuid,
      orgId: null,
      authToken: "token",
    });
    vi.mocked(getAccountWithDetails).mockResolvedValue(account as never);

    const req = new NextRequest("http://localhost/api/accounts/" + validUuid);
    const res = await getAccountHandler(req, Promise.resolve({ id: validUuid }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.account).toEqual(account);
  });
});
