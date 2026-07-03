import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateRemoveOrgMemberRequest } from "../validateRemoveOrgMemberRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrgMembers } from "@/lib/organizations/canManageOrgMembers";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canManageOrgMembers", () => ({
  canManageOrgMembers: vi.fn(),
}));

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";

function buildRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/organizations/members${query}`, {
    method: "DELETE",
  });
}

describe("validateRemoveOrgMemberRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "caller-1",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(canManageOrgMembers).mockResolvedValue(true);
  });

  it("returns the caller account ID and query for a valid request", async () => {
    const result = await validateRemoveOrgMemberRequest(
      buildRequest(`?organization_id=${ORG_ID}&account_id=${ACCOUNT_ID}`),
    );

    expect(result).toEqual({
      callerAccountId: "caller-1",
      query: { organization_id: ORG_ID, account_id: ACCOUNT_ID },
    });
    expect(canManageOrgMembers).toHaveBeenCalledWith({
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

    const result = await validateRemoveOrgMemberRequest(
      buildRequest(`?organization_id=${ORG_ID}&account_id=${ACCOUNT_ID}`),
    );

    expect(result).toBe(unauthorized);
    expect(canManageOrgMembers).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller cannot manage the organization", async () => {
    vi.mocked(canManageOrgMembers).mockResolvedValue(false);

    const result = await validateRemoveOrgMemberRequest(
      buildRequest(`?organization_id=${ORG_ID}&account_id=${ACCOUNT_ID}`),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(403);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(typeof body.message).toBe("string");
    }
  });

  it("returns 400 when organization_id is missing", async () => {
    const result = await validateRemoveOrgMemberRequest(buildRequest(`?account_id=${ACCOUNT_ID}`));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(typeof body.message).toBe("string");
    }
  });

  it("returns 400 when account_id is missing", async () => {
    const result = await validateRemoveOrgMemberRequest(buildRequest(`?organization_id=${ORG_ID}`));

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(typeof body.message).toBe("string");
    }
  });

  it("returns 400 when organization_id is not a UUID", async () => {
    const result = await validateRemoveOrgMemberRequest(
      buildRequest(`?organization_id=nope&account_id=${ACCOUNT_ID}`),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(typeof body.message).toBe("string");
    }
  });

  it("returns 400 when account_id is not a UUID", async () => {
    const result = await validateRemoveOrgMemberRequest(
      buildRequest(`?organization_id=${ORG_ID}&account_id=nope`),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.status).toBe("error");
      expect(typeof body.message).toBe("string");
    }
  });
});
