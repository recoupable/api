import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateRemoveOrgDomainRequest } from "../validateRemoveOrgDomainRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canManageOrganization", () => ({
  canManageOrganization: vi.fn(),
}));

const ORG_ID = "9f0b5f61-6f8d-4b64-92f5-0d1a5f0a1c2e";

function buildRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/organizations/domains${query}`, {
    method: "DELETE",
  });
}

describe("validateRemoveOrgDomainRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "caller-1",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(canManageOrganization).mockResolvedValue(true);
  });

  it("returns the caller account ID and query with a normalized domain", async () => {
    const result = await validateRemoveOrgDomainRequest(
      buildRequest(`?organization_id=${ORG_ID}&domain=@SeekerMusic.COM`),
    );

    expect(result).toEqual({
      callerAccountId: "caller-1",
      query: { organization_id: ORG_ID, domain: "seekermusic.com" },
    });
    expect(canManageOrganization).toHaveBeenCalledWith({
      accountId: "caller-1",
      organizationId: ORG_ID,
    });
  });

  it("returns the auth error response when authentication fails", async () => {
    const unauthorized = NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401 },
    );
    vi.mocked(validateAuthContext).mockResolvedValue(unauthorized);

    const result = await validateRemoveOrgDomainRequest(
      buildRequest(`?organization_id=${ORG_ID}&domain=seekermusic.com`),
    );

    expect(result).toBe(unauthorized);
    expect(canManageOrganization).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller cannot manage the organization", async () => {
    vi.mocked(canManageOrganization).mockResolvedValue(false);

    const result = await validateRemoveOrgDomainRequest(
      buildRequest(`?organization_id=${ORG_ID}&domain=seekermusic.com`),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(403);
      const body = await result.json();
      expect(body).toEqual({
        status: "error",
        error: "Access denied to specified organization_id",
      });
    }
  });

  it("returns 400 when organization_id is missing", async () => {
    const result = await validateRemoveOrgDomainRequest(buildRequest("?domain=seekermusic.com"));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(body.error).toContain("organization_id");
    }
  });

  it("returns 400 when domain is missing", async () => {
    const result = await validateRemoveOrgDomainRequest(buildRequest(`?organization_id=${ORG_ID}`));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(body.error).toContain("domain");
    }
  });

  it("returns 400 when domain is not a plausible bare domain", async () => {
    const result = await validateRemoveOrgDomainRequest(
      buildRequest(`?organization_id=${ORG_ID}&domain=nodot`),
    );

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
