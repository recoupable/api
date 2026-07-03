import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAddOrgMemberRequest } from "../validateAddOrgMemberRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canManageOrganization", () => ({
  canManageOrganization: vi.fn(),
}));

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/organizations/members", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("validateAddOrgMemberRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "caller-1",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(canManageOrganization).mockResolvedValue(true);
  });

  describe("valid requests", () => {
    it("returns the caller account ID and body for organizationId with accountId", async () => {
      const result = await validateAddOrgMemberRequest(
        buildRequest({ organizationId: ORG_ID, accountId: ACCOUNT_ID }),
      );

      expect(result).toEqual({
        callerAccountId: "caller-1",
        body: { organizationId: ORG_ID, accountId: ACCOUNT_ID },
      });
      expect(canManageOrganization).toHaveBeenCalledWith({
        accountId: "caller-1",
        organizationId: ORG_ID,
      });
    });

    it("returns the caller account ID and body for organizationId with email", async () => {
      const result = await validateAddOrgMemberRequest(
        buildRequest({ organizationId: ORG_ID, email: "member@example.com" }),
      );

      expect(result).toEqual({
        callerAccountId: "caller-1",
        body: { organizationId: ORG_ID, email: "member@example.com" },
      });
    });
  });

  describe("auth and access errors", () => {
    it("returns the auth error response when authentication fails", async () => {
      const unauthorized = NextResponse.json(
        { status: "error", error: "Unauthorized" },
        { status: 401 },
      );
      vi.mocked(validateAuthContext).mockResolvedValue(unauthorized);

      const result = await validateAddOrgMemberRequest(
        buildRequest({ organizationId: ORG_ID, accountId: ACCOUNT_ID }),
      );

      expect(result).toBe(unauthorized);
      expect(canManageOrganization).not.toHaveBeenCalled();
    });

    it("returns 403 when the caller cannot manage the organization", async () => {
      vi.mocked(canManageOrganization).mockResolvedValue(false);

      const result = await validateAddOrgMemberRequest(
        buildRequest({ organizationId: ORG_ID, accountId: ACCOUNT_ID }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(403);
        const body = await result.json();
        expect(body.status).toBe("error");
        expect(typeof body.error).toBe("string");
      }
    });
  });

  describe("invalid bodies", () => {
    it("returns 400 when organizationId is missing", async () => {
      const result = await validateAddOrgMemberRequest(buildRequest({ accountId: ACCOUNT_ID }));

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.status).toBe("error");
        expect(typeof body.error).toBe("string");
      }
    });

    it("returns 400 when organizationId is not a UUID", async () => {
      const result = await validateAddOrgMemberRequest(
        buildRequest({ organizationId: "not-a-uuid", accountId: ACCOUNT_ID }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.status).toBe("error");
        expect(typeof body.error).toBe("string");
      }
    });

    it("returns 400 when accountId is not a UUID", async () => {
      const result = await validateAddOrgMemberRequest(
        buildRequest({ organizationId: ORG_ID, accountId: "not-a-uuid" }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.status).toBe("error");
        expect(typeof body.error).toBe("string");
      }
    });

    it("returns 400 when email is not a valid email", async () => {
      const result = await validateAddOrgMemberRequest(
        buildRequest({ organizationId: ORG_ID, email: "not-an-email" }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.status).toBe("error");
        expect(typeof body.error).toBe("string");
      }
    });

    it("returns 400 when both accountId and email are provided", async () => {
      const result = await validateAddOrgMemberRequest(
        buildRequest({
          organizationId: ORG_ID,
          accountId: ACCOUNT_ID,
          email: "member@example.com",
        }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.error).toContain("exactly one");
      }
    });

    it("returns 400 when neither accountId nor email is provided", async () => {
      const result = await validateAddOrgMemberRequest(buildRequest({ organizationId: ORG_ID }));

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.error).toContain("exactly one");
      }
    });

    it("returns 400 when the body is not valid JSON", async () => {
      const result = await validateAddOrgMemberRequest(buildRequest("not-json"));

      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
        const body = await result.json();
        expect(body.status).toBe("error");
        expect(typeof body.error).toBe("string");
      }
      expect(canManageOrganization).not.toHaveBeenCalled();
    });
  });
});
