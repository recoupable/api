import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getArtistFansHandler } from "../getArtistFansHandler";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  accounts: vi.fn(),
  access: vi.fn(),
  socials: vi.fn(),
  fans: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: mocks.auth }));
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({ selectAccounts: mocks.accounts }));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: mocks.access,
}));
vi.mock("@/lib/supabase/account_socials/selectAccountSocialIds", () => ({
  selectAccountSocialIds: mocks.socials,
}));
vi.mock("@/lib/supabase/social_fans/selectSocialFans", () => ({ selectSocialFans: mocks.fans }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));
const ARTIST = "11111111-1111-4111-8111-111111111111";
const request = () => new NextRequest(`https://example.invalid/api/artists/${ARTIST}/fans`);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ accountId: "account_fixture" });
  mocks.accounts.mockResolvedValue([{ id: ARTIST }]);
  mocks.access.mockResolvedValue(true);
  mocks.socials.mockResolvedValue(["artist_social_fixture"]);
  mocks.fans.mockResolvedValue({
    rows: [
      {
        fan_social: { id: "fan_fixture", username: "fan" },
        latest_engagement_comment: {
          social_id: "fan_fixture",
          commented_at: "2026-10-01T12:00:00Z",
        },
      },
    ],
    totalCount: 1,
  });
});
it("returns comment recency through the authorized public handler and real projection", async () => {
  const response = await getArtistFansHandler(request(), ARTIST);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    status: "success",
    fans: [{ id: "fan_fixture", last_comment_at: "2026-10-01T12:00:00Z" }],
  });
  expect(mocks.access).toHaveBeenCalledWith("account_fixture", ARTIST);
  expect(mocks.socials).toHaveBeenCalledExactlyOnceWith(ARTIST);
  expect(mocks.fans).toHaveBeenCalledWith(
    expect.objectContaining({ social_ids: ["artist_social_fixture"] }),
  );
});
it("denies an unowned artist before reading fan/comment data", async () => {
  mocks.access.mockResolvedValue(false);
  const response = await getArtistFansHandler(request(), ARTIST);
  expect(response.status).toBe(403);
  expect(mocks.socials).not.toHaveBeenCalled();
  expect(mocks.fans).not.toHaveBeenCalled();
});
it("denies missing authentication before reading artist or fan data", async () => {
  mocks.auth.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  expect((await getArtistFansHandler(request(), ARTIST)).status).toBe(401);
  expect(mocks.accounts).not.toHaveBeenCalled();
  expect(mocks.socials).not.toHaveBeenCalled();
  expect(mocks.fans).not.toHaveBeenCalled();
});
