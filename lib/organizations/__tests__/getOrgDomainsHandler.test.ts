import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getOrgDomainsHandler } from "../getOrgDomainsHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";
import { selectOrganizationDomains } from "@/lib/supabase/organization_domains/selectOrganizationDomains";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canManageOrganization", () => ({
  canManageOrganization: vi.fn(),
}));

vi.mock("@/lib/supabase/organization_domains/selectOrganizationDomains", () => ({
  selectOrganizationDomains: vi.fn(),
}));

const ORG_ID = "9f0b5f61-6f8d-4b64-92f5-0d1a5f0a1c2e";

function makeRequest(query = `?organization_id=${ORG_ID}`) {
  return new NextRequest(`http://x/api/organizations/domains${query}`);
}

describe("getOrgDomainsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-1",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(canManageOrganization).mockResolvedValue(true);
  });

  describe("successful cases", () => {
    it("returns the organization's domains", async () => {
      const rows = [
        {
          id: "dom-1",
          domain: "seekermusic.com",
          organization_id: ORG_ID,
          created_at: "2026-01-01",
        },
      ];
      vi.mocked(selectOrganizationDomains).mockResolvedValue(rows);

      const response = await getOrgDomainsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ status: "success", domains: rows });
      expect(selectOrganizationDomains).toHaveBeenCalledWith(ORG_ID);
      expect(canManageOrganization).toHaveBeenCalledWith({
        accountId: "acc-1",
        organizationId: ORG_ID,
      });
    });

    it("returns an empty list when no domains are mapped", async () => {
      vi.mocked(selectOrganizationDomains).mockResolvedValue([]);

      const response = await getOrgDomainsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.domains).toEqual([]);
    });
  });

  describe("error cases", () => {
    it("returns the auth error response when unauthenticated", async () => {
      const authError = NextResponse.json(
        { status: "error", message: "unauthorized" },
        { status: 401 },
      );
      vi.mocked(validateAuthContext).mockResolvedValue(authError);

      const response = await getOrgDomainsHandler(makeRequest());

      expect(response.status).toBe(401);
      expect(selectOrganizationDomains).not.toHaveBeenCalled();
    });

    it("returns 400 when organization_id is missing", async () => {
      const response = await getOrgDomainsHandler(makeRequest(""));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.status).toBe("error");
      expect(typeof body.error).toBe("string");
    });

    it("returns 403 when the caller cannot manage the organization", async () => {
      vi.mocked(canManageOrganization).mockResolvedValue(false);

      const response = await getOrgDomainsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({
        status: "error",
        error: "Access denied to specified organization_id",
      });
      expect(selectOrganizationDomains).not.toHaveBeenCalled();
    });

    it("returns 500 when the query fails", async () => {
      vi.mocked(selectOrganizationDomains).mockResolvedValue(null);

      const response = await getOrgDomainsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.status).toBe("error");
      expect(typeof body.error).toBe("string");
    });

    it("returns a generic 500 without leaking exception details when a dependency throws", async () => {
      vi.mocked(selectOrganizationDomains).mockRejectedValue(new Error("SECRET_DB_DETAIL"));

      const response = await getOrgDomainsHandler(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ status: "error", error: "Internal server error" });
      expect(JSON.stringify(body)).not.toContain("SECRET_DB_DETAIL");
    });
  });
});
