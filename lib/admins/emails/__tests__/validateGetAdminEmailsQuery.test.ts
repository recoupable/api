import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateGetAdminEmailsQuery } from "../validateGetAdminEmailsQuery";
import { validateAdminAuth } from "@/lib/admins/validateAdminAuth";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/admins/validateAdminAuth", () => ({
  validateAdminAuth: vi.fn(),
}));

function createMockRequest(url: string): NextRequest {
  return {
    url,
    nextUrl: new URL(url),
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateAdminAuth).mockResolvedValue({ accountId: "admin-acc" });
});

describe("validateGetAdminEmailsQuery", () => {
  it("returns account_id mode when account_id provided", async () => {
    const request = createMockRequest("http://localhost:3000/api/admins/emails?account_id=acc-123");
    const result = await validateGetAdminEmailsQuery(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ mode: "account", accountId: "acc-123" });
  });

  it("returns email_id mode when email_id provided", async () => {
    const request = createMockRequest("http://localhost:3000/api/admins/emails?email_id=email-abc");
    const result = await validateGetAdminEmailsQuery(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ mode: "email", emailId: "email-abc" });
  });

  it("prefers email_id when both provided", async () => {
    const request = createMockRequest("http://localhost:3000/api/admins/emails?account_id=acc-123&email_id=email-abc");
    const result = await validateGetAdminEmailsQuery(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ mode: "email", emailId: "email-abc" });
  });

  it("returns 400 when neither provided", async () => {
    const request = createMockRequest("http://localhost:3000/api/admins/emails");
    const result = await validateGetAdminEmailsQuery(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
    }
  });

  it("returns auth error when not admin", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValueOnce(
      NextResponse.json({ status: "error" }, { status: 403 }),
    );

    const request = createMockRequest("http://localhost:3000/api/admins/emails?account_id=acc-123");
    const result = await validateGetAdminEmailsQuery(request);

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(403);
    }
  });

  it("trims whitespace from params", async () => {
    const request = createMockRequest("http://localhost:3000/api/admins/emails?email_id=%20email-abc%20");
    const result = await validateGetAdminEmailsQuery(request);

    expect(result).toEqual({ mode: "email", emailId: "email-abc" });
  });
});
