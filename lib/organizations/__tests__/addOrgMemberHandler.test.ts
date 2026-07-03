import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { addOrgMemberHandler } from "../addOrgMemberHandler";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrgMembers } from "@/lib/organizations/canManageOrgMembers";
import { getOrCreateAccountByEmail } from "@/lib/accounts/getOrCreateAccountByEmail";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { addAccountToOrganization } from "@/lib/supabase/account_organization_ids/addAccountToOrganization";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canManageOrgMembers", () => ({
  canManageOrgMembers: vi.fn(),
}));

vi.mock("@/lib/accounts/getOrCreateAccountByEmail", () => ({
  getOrCreateAccountByEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

vi.mock("@/lib/supabase/account_organization_ids/addAccountToOrganization", () => ({
  addAccountToOrganization: vi.fn(),
}));

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/organizations/members", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("addOrgMemberHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "caller-1",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(canManageOrgMembers).mockResolvedValue(true);
    vi.mocked(getAccountOrganizations).mockResolvedValue([]);
    vi.mocked(addAccountToOrganization).mockResolvedValue("membership-1");
  });

  describe("successful cases", () => {
    it("adds a member by accountId and returns the membership id", async () => {
      const response = await addOrgMemberHandler(
        buildRequest({ organizationId: ORG_ID, accountId: MEMBER_ID }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        status: "success",
        id: "membership-1",
        account_id: MEMBER_ID,
      });
      expect(addAccountToOrganization).toHaveBeenCalledWith(MEMBER_ID, ORG_ID);
    });

    it("returns the existing membership when the account is already a member", async () => {
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        {
          id: "existing-membership-1",
          account_id: MEMBER_ID,
          organization_id: ORG_ID,
          updated_at: null,
          organization: null,
        },
      ]);

      const response = await addOrgMemberHandler(
        buildRequest({ organizationId: ORG_ID, accountId: MEMBER_ID }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        status: "success",
        id: "existing-membership-1",
        account_id: MEMBER_ID,
      });
      expect(addAccountToOrganization).not.toHaveBeenCalled();
    });

    it("resolves an email to an account and adds it as a member", async () => {
      vi.mocked(getOrCreateAccountByEmail).mockResolvedValue(MEMBER_ID);

      const response = await addOrgMemberHandler(
        buildRequest({ organizationId: ORG_ID, email: "member@example.com" }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        status: "success",
        id: "membership-1",
        account_id: MEMBER_ID,
      });
      expect(getOrCreateAccountByEmail).toHaveBeenCalledWith("member@example.com");
      expect(addAccountToOrganization).toHaveBeenCalledWith(MEMBER_ID, ORG_ID);
    });
  });

  describe("error cases", () => {
    it("returns the auth error response when authentication fails", async () => {
      const unauthorized = NextResponse.json(
        { status: "error", error: "Unauthorized" },
        { status: 401 },
      );
      vi.mocked(validateAuthContext).mockResolvedValue(unauthorized);

      const response = await addOrgMemberHandler(
        buildRequest({ organizationId: ORG_ID, accountId: MEMBER_ID }),
      );

      expect(response.status).toBe(401);
      expect(canManageOrgMembers).not.toHaveBeenCalled();
    });

    it("returns 400 when the body is invalid", async () => {
      const response = await addOrgMemberHandler(buildRequest({ organizationId: ORG_ID }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.status).toBe("error");
      expect(typeof body.message).toBe("string");
    });

    it("returns 400 when the body is not valid JSON", async () => {
      const request = new NextRequest("http://localhost/api/organizations/members", {
        method: "POST",
        body: "not-json",
      });

      const response = await addOrgMemberHandler(request);

      expect(response.status).toBe(400);
    });

    it("returns 403 when the caller cannot manage the organization", async () => {
      vi.mocked(canManageOrgMembers).mockResolvedValue(false);

      const response = await addOrgMemberHandler(
        buildRequest({ organizationId: ORG_ID, accountId: MEMBER_ID }),
      );

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.status).toBe("error");
      expect(typeof body.message).toBe("string");
      expect(canManageOrgMembers).toHaveBeenCalledWith({
        accountId: "caller-1",
        organizationId: ORG_ID,
      });
    });

    it("returns 500 when the email cannot be resolved to an account", async () => {
      vi.mocked(getOrCreateAccountByEmail).mockResolvedValue(null);

      const response = await addOrgMemberHandler(
        buildRequest({ organizationId: ORG_ID, email: "member@example.com" }),
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.status).toBe("error");
    });

    it("returns 500 when the membership insert fails", async () => {
      vi.mocked(addAccountToOrganization).mockResolvedValue(null);

      const response = await addOrgMemberHandler(
        buildRequest({ organizationId: ORG_ID, accountId: MEMBER_ID }),
      );

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.status).toBe("error");
    });
  });
});
