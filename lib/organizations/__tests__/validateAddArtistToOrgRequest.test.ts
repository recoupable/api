import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAddArtistToOrgRequest } from "../validateAddArtistToOrgRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { canManageOrganization } from "@/lib/organizations/canManageOrganization";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/canManageOrganization", () => ({
  canManageOrganization: vi.fn(),
}));

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const ARTIST_ID = "22222222-2222-4222-8222-222222222222";

function buildRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/organizations/artists", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("validateAddArtistToOrgRequest", () => {
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
    it("returns the caller account ID and body when the caller can manage the org", async () => {
      const result = await validateAddArtistToOrgRequest(
        buildRequest({ artistId: ARTIST_ID, organizationId: ORG_ID }),
      );

      expect(result).toEqual({
        callerAccountId: "caller-1",
        body: { artistId: ARTIST_ID, organizationId: ORG_ID },
      });
      expect(canManageOrganization).toHaveBeenCalledWith({
        accountId: "caller-1",
        organizationId: ORG_ID,
      });
    });
  });

  describe("authentication", () => {
    it("returns 401 when the caller is unauthenticated", async () => {
      const unauthorized = NextResponse.json({ status: "error" }, { status: 401 });
      vi.mocked(validateAuthContext).mockResolvedValue(unauthorized);

      const result = await validateAddArtistToOrgRequest(
        buildRequest({ artistId: ARTIST_ID, organizationId: ORG_ID }),
      );

      expect(result).toBe(unauthorized);
    });

    it("authenticates before validating the body, so an unauthenticated caller learns nothing about the schema", async () => {
      const unauthorized = NextResponse.json({ status: "error" }, { status: 401 });
      vi.mocked(validateAuthContext).mockResolvedValue(unauthorized);

      const result = await validateAddArtistToOrgRequest(buildRequest({}));

      expect(result).toBe(unauthorized);
      expect(canManageOrganization).not.toHaveBeenCalled();
    });
  });

  describe("authorization", () => {
    it("returns 403 when the caller cannot manage the organization", async () => {
      vi.mocked(canManageOrganization).mockResolvedValue(false);

      const result = await validateAddArtistToOrgRequest(
        buildRequest({ artistId: ARTIST_ID, organizationId: ORG_ID }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(403);
    });
  });

  describe("body validation", () => {
    it("returns 400 when artistId is missing", async () => {
      const result = await validateAddArtistToOrgRequest(buildRequest({ organizationId: ORG_ID }));

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when organizationId is missing", async () => {
      const result = await validateAddArtistToOrgRequest(buildRequest({ artistId: ARTIST_ID }));

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when artistId is not a UUID", async () => {
      const result = await validateAddArtistToOrgRequest(
        buildRequest({ artistId: "not-a-uuid", organizationId: ORG_ID }),
      );

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when the body is not valid JSON", async () => {
      const result = await validateAddArtistToOrgRequest(buildRequest("{oops"));

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });
  });
});
