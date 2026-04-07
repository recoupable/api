import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateGetAccountEmailsQuery } from "../validateGetAccountEmailsQuery";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

function createMockRequest(url: string): NextRequest {
  return {
    url,
    nextUrl: new URL(url),
    headers: new Headers({ authorization: "Bearer test-token" }),
  } as unknown as NextRequest;
}

describe("validateGetAccountEmailsQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error when validateAuthContext fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateGetAccountEmailsQuery(
      createMockRequest("http://localhost:3000/api/accounts/emails?artist_account_id=artist-123"),
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect(validateAuthContext).toHaveBeenCalledTimes(1);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401);
    }
  });

  it("returns 400 when artist_account_id is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "token",
    });

    const result = await validateGetAccountEmailsQuery(
      createMockRequest("http://localhost:3000/api/accounts/emails"),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      await expect(result.json()).resolves.toEqual({
        status: "error",
        missing_fields: ["artist_account_id"],
        error: "artist_account_id parameter is required",
      });
    }
  });

  it("returns parsed artist and repeated account IDs", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "account-123",
      orgId: null,
      authToken: "token",
    });

    const result = await validateGetAccountEmailsQuery(
      createMockRequest(
        "http://localhost:3000/api/accounts/emails?artist_account_id=artist-456&account_id=acc-1&account_id=acc-2",
      ),
    );

    expect(result).toEqual({
      authenticatedAccountId: "account-123",
      artistAccountId: "artist-456",
      accountIds: ["acc-1", "acc-2"],
    });
  });
});
