import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { getAccountHandler } from "@/lib/accounts/getAccountHandler";
import { validateGetAccountParams } from "@/lib/accounts/validateGetAccountParams";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/accounts/validateGetAccountParams", () => ({
  validateGetAccountParams: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/getAccountWithDetails", () => ({
  getAccountWithDetails: vi.fn(),
}));

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("getAccountHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when validateGetAccountParams fails", async () => {
    vi.mocked(validateGetAccountParams).mockResolvedValue(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );

    const req = new NextRequest("http://localhost/api/accounts/" + validUuid);
    const res = await getAccountHandler(req, Promise.resolve({ id: validUuid }));

    expect(res.status).toBe(401);
    expect(getAccountWithDetails).not.toHaveBeenCalled();
  });

  it("returns 404 when account is not found after successful auth", async () => {
    vi.mocked(validateGetAccountParams).mockResolvedValue(validUuid);
    vi.mocked(getAccountWithDetails).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/accounts/" + validUuid);
    const res = await getAccountHandler(req, Promise.resolve({ id: validUuid }));

    expect(res.status).toBe(404);
    expect(getAccountWithDetails).toHaveBeenCalledWith(validUuid);
  });

  it("returns 200 with account when authorized and found", async () => {
    const account = { id: validUuid, name: "Test" };
    vi.mocked(validateGetAccountParams).mockResolvedValue(validUuid);
    vi.mocked(getAccountWithDetails).mockResolvedValue(account as never);

    const req = new NextRequest("http://localhost/api/accounts/" + validUuid);
    const res = await getAccountHandler(req, Promise.resolve({ id: validUuid }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(body.account).toEqual(account);
  });

  it("passes request and id to validateGetAccountParams", async () => {
    vi.mocked(validateGetAccountParams).mockResolvedValue(validUuid);
    vi.mocked(getAccountWithDetails).mockResolvedValue({ id: validUuid } as never);

    const req = new NextRequest("http://localhost/api/accounts/" + validUuid);
    await getAccountHandler(req, Promise.resolve({ id: validUuid }));

    expect(validateGetAccountParams).toHaveBeenCalledWith(req, validUuid);
  });

  it("works with email path parameter", async () => {
    const email = "customer@example.com";
    const accountId = "550e8400-e29b-41d4-a716-446655440099";
    const account = { id: accountId, name: "Customer" };

    vi.mocked(validateGetAccountParams).mockResolvedValue(accountId);
    vi.mocked(getAccountWithDetails).mockResolvedValue(account as never);

    const req = new NextRequest("http://localhost/api/accounts/" + email);
    const res = await getAccountHandler(req, Promise.resolve({ id: email }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.account).toEqual(account);
    expect(validateGetAccountParams).toHaveBeenCalledWith(req, email);
  });
});
