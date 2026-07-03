import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetOrgDomainsRequest } from "../validateGetOrgDomainsRequest";

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
  return new NextRequest(`http://localhost/api/organizations/domains${query}`);
}

describe("validateGetOrgDomainsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "caller-1",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(canManageOrganization).mockResolvedValue(true);
  });

  it("returns the caller account ID and query for a valid request", async () => {
    const result = await validateGetOrgDomainsRequest(buildRequest(`?organization_id=${ORG_ID}`));

    expect(result).toEqual({
      callerAccountId: "caller-1",
      query: { organization_id: ORG_ID },
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

    const result = await validateGetOrgDomainsRequest(buildRequest(`?organization_id=${ORG_ID}`));

    expect(result).toBe(unauthorized);
    expect(canManageOrganization).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller cannot manage the organization", async () => {
    vi.mocked(canManageOrganization).mockResolvedValue(false);

    const result = await validateGetOrgDomainsRequest(buildRequest(`?organization_id=${ORG_ID}`));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(403);
      const body = await result.json();
      expect(body).toEqual({
        status: "error",
        message: "Access denied to specified organization_id",
      });
    }
  });

  it("returns 400 when organization_id is missing", async () => {
    const result = await validateGetOrgDomainsRequest(buildRequest(""));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(body.message).toContain("organization_id");
    }
    expect(canManageOrganization).not.toHaveBeenCalled();
  });

  it("returns 400 when organization_id is not a UUID", async () => {
    const result = await validateGetOrgDomainsRequest(buildRequest("?organization_id=org-1"));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(typeof body.message).toBe("string");
    }
  });
});
