import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { addOrgDomainHandler } from "../addOrgDomainHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";
import { selectOrganizationDomain } from "@/lib/supabase/organization_domains/selectOrganizationDomain";
import { insertOrganizationDomain } from "@/lib/supabase/organization_domains/insertOrganizationDomain";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canManageOrganization", () => ({
  canManageOrganization: vi.fn(),
}));

vi.mock("@/lib/supabase/organization_domains/selectOrganizationDomain", () => ({
  selectOrganizationDomain: vi.fn(),
}));

vi.mock("@/lib/supabase/organization_domains/insertOrganizationDomain", () => ({
  insertOrganizationDomain: vi.fn(),
}));

const ORG_ID = "9f0b5f61-6f8d-4b64-92f5-0d1a5f0a1c2e";
const OTHER_ORG_ID = "1b2c3d4e-5f60-4a71-8b92-a3b4c5d6e7f8";

function makeRequest(body: unknown) {
  return new NextRequest("http://x/api/organizations/domains", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("addOrgDomainHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-1",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(canManageOrganization).mockResolvedValue(true);
    vi.mocked(selectOrganizationDomain).mockResolvedValue(null);
  });

  describe("successful cases", () => {
    it("inserts a new mapping with a normalized domain", async () => {
      vi.mocked(insertOrganizationDomain).mockResolvedValue({
        id: "dom-1",
        domain: "seekermusic.com",
        organization_id: ORG_ID,
        created_at: "2026-01-01",
      });

      const response = await addOrgDomainHandler(
        makeRequest({ organizationId: ORG_ID, domain: " @SeekerMusic.COM " }),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        status: "success",
        id: "dom-1",
        domain: "seekermusic.com",
        organization_id: ORG_ID,
      });
      expect(selectOrganizationDomain).toHaveBeenCalledWith("seekermusic.com");
      expect(insertOrganizationDomain).toHaveBeenCalledWith({
        domain: "seekermusic.com",
        organizationId: ORG_ID,
      });
    });

    it("is idempotent when the domain is already mapped to the same org", async () => {
      vi.mocked(selectOrganizationDomain).mockResolvedValue({
        id: "dom-1",
        domain: "seekermusic.com",
        organization_id: ORG_ID,
        created_at: "2026-01-01",
      });

      const response = await addOrgDomainHandler(
        makeRequest({ organizationId: ORG_ID, domain: "seekermusic.com" }),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        status: "success",
        id: "dom-1",
        domain: "seekermusic.com",
        organization_id: ORG_ID,
      });
      expect(insertOrganizationDomain).not.toHaveBeenCalled();
    });
  });

  describe("error cases", () => {
    it("returns the auth error response when unauthenticated", async () => {
      const authError = NextResponse.json(
        { status: "error", message: "unauthorized" },
        { status: 401 },
      );
      vi.mocked(validateAuthContext).mockResolvedValue(authError);

      const response = await addOrgDomainHandler(
        makeRequest({ organizationId: ORG_ID, domain: "seekermusic.com" }),
      );

      expect(response.status).toBe(401);
      expect(insertOrganizationDomain).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid body", async () => {
      const response = await addOrgDomainHandler(
        makeRequest({ organizationId: ORG_ID, domain: "not a domain" }),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.status).toBe("error");
      expect(typeof body.error).toBe("string");
    });

    it("returns 403 when the caller cannot manage the organization", async () => {
      vi.mocked(canManageOrganization).mockResolvedValue(false);

      const response = await addOrgDomainHandler(
        makeRequest({ organizationId: ORG_ID, domain: "seekermusic.com" }),
      );
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({
        status: "error",
        error: "Access denied to specified organization_id",
      });
      expect(insertOrganizationDomain).not.toHaveBeenCalled();
    });

    it("returns 409 when the domain is mapped to a different org", async () => {
      vi.mocked(selectOrganizationDomain).mockResolvedValue({
        id: "dom-1",
        domain: "seekermusic.com",
        organization_id: OTHER_ORG_ID,
        created_at: "2026-01-01",
      });

      const response = await addOrgDomainHandler(
        makeRequest({ organizationId: ORG_ID, domain: "seekermusic.com" }),
      );
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.status).toBe("error");
      expect(body.error).toContain("already mapped");
      expect(insertOrganizationDomain).not.toHaveBeenCalled();
    });

    it("returns 500 when the insert fails", async () => {
      vi.mocked(insertOrganizationDomain).mockResolvedValue(null);

      const response = await addOrgDomainHandler(
        makeRequest({ organizationId: ORG_ID, domain: "seekermusic.com" }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.status).toBe("error");
      expect(typeof body.error).toBe("string");
    });

    it("returns 500 and does not insert when the existing-mapping lookup fails", async () => {
      vi.mocked(selectOrganizationDomain).mockRejectedValue(
        new Error("Failed to fetch organization_domain: boom"),
      );

      const response = await addOrgDomainHandler(
        makeRequest({ organizationId: ORG_ID, domain: "seekermusic.com" }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ status: "error", error: "Internal server error" });
      expect(insertOrganizationDomain).not.toHaveBeenCalled();
    });

    it("returns a generic 500 without leaking exception details when a dependency throws", async () => {
      vi.mocked(insertOrganizationDomain).mockRejectedValue(new Error("SECRET_DB_DETAIL"));

      const response = await addOrgDomainHandler(
        makeRequest({ organizationId: ORG_ID, domain: "seekermusic.com" }),
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ status: "error", error: "Internal server error" });
      expect(JSON.stringify(body)).not.toContain("SECRET_DB_DETAIL");
    });
  });
});
