import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetCreditsRequest } from "@/lib/credits/validateGetCreditsRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT = "11111111-2222-3333-4444-555555555555";

const buildRequest = () => new NextRequest("http://localhost/api/credits");

describe("validateGetCreditsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { accountId } when auth succeeds", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT,
      orgId: null,
      authToken: "token",
    });

    const result = await validateGetCreditsRequest(buildRequest());
    expect(result).toEqual({ accountId: ACCOUNT });
  });

  it("returns the auth-error response unchanged when auth fails", async () => {
    const err = NextResponse.json({ message: "unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(err);

    const result = await validateGetCreditsRequest(buildRequest());
    expect(result).toBe(err);
  });
});
