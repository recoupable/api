import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateRunValuationRequest } from "@/lib/valuation/validateRunValuationRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));

const post = (body: unknown) =>
  new NextRequest("http://x/api/valuation", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("validateRunValuationRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_1",
    } as never);
  });

  it("returns the auth response (401) when auth fails, before touching the body", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 401 }) as never,
    );
    const r = await validateRunValuationRequest(post({ spotify_artist_id: "x" }));
    expect((r as NextResponse).status).toBe(401);
  });

  it("400s with an error envelope when spotify_artist_id is missing", async () => {
    const r = await validateRunValuationRequest(post({}));
    expect(r).toBeInstanceOf(NextResponse);
    const res = r as NextResponse;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.missing_fields).toEqual(["spotify_artist_id"]);
  });

  it("400s when spotify_artist_id is empty", async () => {
    const r = await validateRunValuationRequest(post({ spotify_artist_id: "" }));
    expect((r as NextResponse).status).toBe(400);
  });

  it("returns { accountId, spotify_artist_id } on success", async () => {
    const r = await validateRunValuationRequest(post({ spotify_artist_id: "0xPoV" }));
    expect(r).toEqual({ accountId: "acc_1", spotify_artist_id: "0xPoV" });
  });

  describe("organization_id owner (chat#1938)", () => {
    const orgId = "7f9c1e2a-3b4d-4c5e-8f60-1a2b3c4d5e6f";

    it("returns the organizationId when the caller is a member", async () => {
      vi.mocked(validateOrganizationAccess).mockResolvedValue(true);

      const r = await validateRunValuationRequest(
        post({ spotify_artist_id: "art_1", organization_id: orgId }),
      );

      expect(validateOrganizationAccess).toHaveBeenCalledWith({
        accountId: "acc_1",
        organizationId: orgId,
      });
      expect(r).toEqual({
        accountId: "acc_1",
        spotify_artist_id: "art_1",
        organizationId: orgId,
      });
    });

    it("403s when the caller is not a member of the organization", async () => {
      vi.mocked(validateOrganizationAccess).mockResolvedValue(false);

      const r = await validateRunValuationRequest(
        post({ spotify_artist_id: "art_1", organization_id: orgId }),
      );

      expect(r).toBeInstanceOf(NextResponse);
      expect((r as NextResponse).status).toBe(403);
    });

    it("400s on a non-uuid organization_id without checking membership", async () => {
      const r = await validateRunValuationRequest(
        post({ spotify_artist_id: "art_1", organization_id: "not-a-uuid" }),
      );

      expect((r as NextResponse).status).toBe(400);
      expect(validateOrganizationAccess).not.toHaveBeenCalled();
    });

    it("leaves organizationId undefined and never checks membership when absent", async () => {
      const r = await validateRunValuationRequest(post({ spotify_artist_id: "art_1" }));

      expect(validateOrganizationAccess).not.toHaveBeenCalled();
      expect(r).toEqual({
        accountId: "acc_1",
        spotify_artist_id: "art_1",
        organizationId: undefined,
      });
    });
  });
});
