import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { removeOrgMemberHandler } from "../removeOrgMemberHandler";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrgMembers } from "@/lib/organizations/canManageOrgMembers";
import { deleteAccountOrganization } from "@/lib/supabase/account_organization_ids/deleteAccountOrganization";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canManageOrgMembers", () => ({
  canManageOrgMembers: vi.fn(),
}));

vi.mock("@/lib/supabase/account_organization_ids/deleteAccountOrganization", () => ({
  deleteAccountOrganization: vi.fn(),
}));

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

function buildRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/organizations/members${query}`, {
    method: "DELETE",
  });
}

describe("removeOrgMemberHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "caller-1",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(canManageOrgMembers).mockResolvedValue(true);
    vi.mocked(deleteAccountOrganization).mockResolvedValue(true);
  });

  describe("successful cases", () => {
    it("removes a member and returns success", async () => {
      const response = await removeOrgMemberHandler(
        buildRequest(`?organization_id=${ORG_ID}&account_id=${MEMBER_ID}`),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: "success" });
      expect(deleteAccountOrganization).toHaveBeenCalledWith(MEMBER_ID, ORG_ID);
    });
  });

  describe("error cases", () => {
    it("returns the auth error response when authentication fails", async () => {
      const unauthorized = NextResponse.json(
        { status: "error", error: "Unauthorized" },
        { status: 401 },
      );
      vi.mocked(validateAuthContext).mockResolvedValue(unauthorized);

      const response = await removeOrgMemberHandler(
        buildRequest(`?organization_id=${ORG_ID}&account_id=${MEMBER_ID}`),
      );

      expect(response.status).toBe(401);
      expect(deleteAccountOrganization).not.toHaveBeenCalled();
    });

    it("returns 400 when query params are missing", async () => {
      const response = await removeOrgMemberHandler(buildRequest(`?organization_id=${ORG_ID}`));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.status).toBe("error");
      expect(typeof body.message).toBe("string");
    });

    it("returns 403 when the caller cannot manage the organization", async () => {
      vi.mocked(canManageOrgMembers).mockResolvedValue(false);

      const response = await removeOrgMemberHandler(
        buildRequest(`?organization_id=${ORG_ID}&account_id=${MEMBER_ID}`),
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.status).toBe("error");
      expect(canManageOrgMembers).toHaveBeenCalledWith({
        accountId: "caller-1",
        organizationId: ORG_ID,
      });
      expect(deleteAccountOrganization).not.toHaveBeenCalled();
    });

    it("returns 500 when the delete fails", async () => {
      vi.mocked(deleteAccountOrganization).mockResolvedValue(false);

      const response = await removeOrgMemberHandler(
        buildRequest(`?organization_id=${ORG_ID}&account_id=${MEMBER_ID}`),
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.status).toBe("error");
      expect(body.message).toBe("Failed to remove member from organization");
    });

    it("returns a generic 500 without leaking exception details when a dependency throws", async () => {
      vi.mocked(deleteAccountOrganization).mockRejectedValue(new Error("SECRET_DB_DETAIL"));

      const response = await removeOrgMemberHandler(
        buildRequest(`?organization_id=${ORG_ID}&account_id=${MEMBER_ID}`),
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ status: "error", message: "Internal server error" });
      expect(JSON.stringify(body)).not.toContain("SECRET_DB_DETAIL");
    });
  });
});
