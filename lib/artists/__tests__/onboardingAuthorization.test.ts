import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createArtistPostHandler } from "../createArtistPostHandler";
import { addArtistToOrgHandler } from "@/lib/organizations/addArtistToOrgHandler";
const mocks = vi.hoisted(() => ({ memberships: vi.fn(), resolve: vi.fn(), attach: vi.fn() }));
vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: vi.fn().mockResolvedValue("10000000-0000-4000-8000-000000000001"),
}));
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({ getApiKeyAccountId: vi.fn() }));
vi.mock("@/lib/auth/validateAccountIdOverride", () => ({ validateAccountIdOverride: vi.fn() }));
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: mocks.memberships,
}));
vi.mock("@/lib/organizations/isRecoupAdmin", () => ({
  isRecoupAdmin: vi.fn().mockResolvedValue(false),
}));
vi.mock("../resolveOrCreateArtist", () => ({ resolveOrCreateArtist: mocks.resolve }));
vi.mock("@/lib/supabase/artist_organization_ids/addArtistToOrganization", () => ({
  addArtistToOrganization: mocks.attach,
}));
const org = "10000000-0000-4000-8000-000000000002";
const artist = "10000000-0000-4000-8000-000000000003";
function request(body: object) {
  return new NextRequest("http://localhost/api/artists", {
    method: "POST",
    headers: { Authorization: "Bearer fixture" },
    body: JSON.stringify(body),
  });
}

describe("non-admin onboarding through real validators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.memberships.mockResolvedValue([{ organization_id: org }]);
    mocks.resolve.mockResolvedValue({ artist: { account_id: artist }, created: false });
    mocks.attach.mockResolvedValue("membership");
  });
  it("allows an organization member through both existing product routes", async () => {
    expect(
      (
        await createArtistPostHandler(
          request({
            name: "Artist",
            organization_id: org,
            spotify_artist_id: "AbCdEfGhIjKlMnOpQrStUv",
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await addArtistToOrgHandler(request({ artistId: artist, organizationId: org }))).status,
    ).toBe(200);
  });
  it("rejects revoked membership on the next call before any write", async () => {
    mocks.memberships.mockResolvedValue([]);
    expect(
      (await createArtistPostHandler(request({ name: "Artist", organization_id: org }))).status,
    ).toBe(403);
    expect(
      (await addArtistToOrgHandler(request({ artistId: artist, organizationId: org }))).status,
    ).toBe(403);
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(mocks.attach).not.toHaveBeenCalled();
  });
});
