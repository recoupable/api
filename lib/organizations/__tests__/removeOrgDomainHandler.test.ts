import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { removeOrgDomainHandler } from "../removeOrgDomainHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";
import { deleteOrganizationDomain } from "@/lib/supabase/organization_domains/deleteOrganizationDomain";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canManageOrganization", () => ({
  canManageOrganization: vi.fn(),
}));

vi.mock("@/lib/supabase/organization_domains/deleteOrganizationDomain", () => ({
  deleteOrganizationDomain: vi.fn(),
}));

const ORG_ID = "9f0b5f61-6f8d-4b64-92f5-0d1a5f0a1c2e";

function makeRequest(query = `?organization_id=${ORG_ID}&domain=@SeekerMusic.COM`) {
  return new NextRequest(`http://x/api/organizations/domains${query}`, { method: "DELETE" });
}

describe("removeOrgDomainHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-1",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(canManageOrganization).mockResolvedValue(true);
    vi.mocked(deleteOrganizationDomain).mockResolvedValue(true);
  });

  describe("successful cases", () => {
    it("deletes the normalized domain mapping", async () => {
      const response = await removeOrgDomainHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ status: "success" });
      expect(deleteOrganizationDomain).toHaveBeenCalledWith({
        domain: "seekermusic.com",
        organizationId: ORG_ID,
      });
    });
  });

  describe("error cases", () => {
    it("returns the auth error response when unauthenticated", async () => {
      const authError = NextResponse.json(
        { status: "error", message: "unauthorized" },
        { status: 401 },
      );
      vi.mocked(validateAuthContext).mockResolvedValue(authError);

      const response = await removeOrgDomainHandler(makeRequest());

      expect(response.status).toBe(401);
      expect(deleteOrganizationDomain).not.toHaveBeenCalled();
    });

    it("returns 400 when domain is missing", async () => {
      const response = await removeOrgDomainHandler(makeRequest(`?organization_id=${ORG_ID}`));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.status).toBe("error");
      expect(typeof body.error).toBe("string");
    });

    it("returns 403 when the caller cannot manage the organization", async () => {
      vi.mocked(canManageOrganization).mockResolvedValue(false);

      const response = await removeOrgDomainHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({
        status: "error",
        error: "Access denied to specified organization_id",
      });
      expect(deleteOrganizationDomain).not.toHaveBeenCalled();
    });

    it("returns 500 when the delete fails", async () => {
      vi.mocked(deleteOrganizationDomain).mockResolvedValue(false);

      const response = await removeOrgDomainHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.status).toBe("error");
      expect(typeof body.error).toBe("string");
    });

    it("returns a generic 500 without leaking exception details when a dependency throws", async () => {
      vi.mocked(deleteOrganizationDomain).mockRejectedValue(new Error("SECRET_DB_DETAIL"));

      const response = await removeOrgDomainHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ status: "error", error: "Internal server error" });
      expect(JSON.stringify(body)).not.toContain("SECRET_DB_DETAIL");
    });
  });
});
