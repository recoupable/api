import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetAccountParams } from "../validateGetAccountParams";
import { resolveAccountIdByEmail } from "../resolveAccountIdByEmail";
import { validateAccountParams } from "../validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../resolveAccountIdByEmail", () => ({
  resolveAccountIdByEmail: vi.fn(),
}));

vi.mock("../validateAccountParams", () => ({
  validateAccountParams: vi.fn(),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("validateGetAccountParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to resolveAccountIdByEmail when id contains @", async () => {
    vi.mocked(resolveAccountIdByEmail).mockResolvedValue("account-123");
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "token",
    });

    const req = new NextRequest("http://localhost/api/accounts/test@example.com");
    const result = await validateGetAccountParams(req, "test@example.com");

    expect(result).toBe("account-123");
    expect(resolveAccountIdByEmail).toHaveBeenCalledWith("test@example.com");
    expect(validateAccountParams).not.toHaveBeenCalled();
  });

  it("delegates to validateAccountParams + validateAuthContext for UUID", async () => {
    vi.mocked(validateAccountParams).mockReturnValue({ id: validUuid });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: validUuid,
      orgId: null,
      authToken: "token",
    });

    const req = new NextRequest("http://localhost/api/accounts/" + validUuid);
    const result = await validateGetAccountParams(req, validUuid);

    expect(result).toBe(validUuid);
    expect(validateAccountParams).toHaveBeenCalledWith(validUuid);
    expect(validateAuthContext).toHaveBeenCalledWith(req, { accountId: validUuid });
    expect(resolveAccountIdByEmail).not.toHaveBeenCalled();
  });

  it("returns error from resolveAccountIdByEmail", async () => {
    vi.mocked(resolveAccountIdByEmail).mockResolvedValue(
      NextResponse.json({ error: "not found" }, { status: 404 }),
    );

    const req = new NextRequest("http://localhost/api/accounts/unknown@example.com");
    const result = await validateGetAccountParams(req, "unknown@example.com");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("returns error from validateAccountParams", async () => {
    vi.mocked(validateAccountParams).mockReturnValue(
      NextResponse.json({ error: "invalid UUID" }, { status: 400 }),
    );

    const req = new NextRequest("http://localhost/api/accounts/not-valid");
    const result = await validateGetAccountParams(req, "not-valid");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns error from validateAuthContext for UUID", async () => {
    vi.mocked(validateAccountParams).mockReturnValue({ id: validUuid });
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );

    const req = new NextRequest("http://localhost/api/accounts/" + validUuid);
    const result = await validateGetAccountParams(req, validUuid);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });
});
