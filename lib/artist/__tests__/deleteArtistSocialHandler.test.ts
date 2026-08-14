import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { deleteArtistSocialHandler } from "../deleteArtistSocialHandler";
import { validateDeleteArtistSocialRequest } from "../validateDeleteArtistSocialRequest";
import { deleteAccountSocial } from "@/lib/supabase/account_socials/deleteAccountSocial";

vi.mock("../validateDeleteArtistSocialRequest", () => ({
  validateDeleteArtistSocialRequest: vi.fn(),
}));
vi.mock("@/lib/supabase/account_socials/deleteAccountSocial", () => ({
  deleteAccountSocial: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const ARTIST_ID = "550e8400-e29b-41d4-a716-446655440000";
const SOCIAL_ID = "660e8400-e29b-41d4-a716-446655440111";
const request = new NextRequest(`http://localhost/api/artists/${ARTIST_ID}/socials/${SOCIAL_ID}`, {
  method: "DELETE",
});

describe("deleteArtistSocialHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the validator's response on failure", async () => {
    const err = NextResponse.json({}, { status: 403 });
    vi.mocked(validateDeleteArtistSocialRequest).mockResolvedValue(err);
    expect(await deleteArtistSocialHandler(request, ARTIST_ID, SOCIAL_ID)).toBe(err);
    expect(deleteAccountSocial).not.toHaveBeenCalled();
  });

  it("returns 200 with a flat body on success", async () => {
    vi.mocked(validateDeleteArtistSocialRequest).mockResolvedValue({
      artistId: ARTIST_ID,
      socialId: SOCIAL_ID,
    });
    vi.mocked(deleteAccountSocial).mockResolvedValue(true);
    const res = await deleteArtistSocialHandler(request, ARTIST_ID, SOCIAL_ID);
    expect(res.status).toBe(200);
    expect(deleteAccountSocial).toHaveBeenCalledWith(ARTIST_ID, SOCIAL_ID);
    expect(await res.json()).toEqual({ success: true, socialId: SOCIAL_ID });
  });

  it("returns 500 when the delete fails", async () => {
    vi.mocked(validateDeleteArtistSocialRequest).mockResolvedValue({
      artistId: ARTIST_ID,
      socialId: SOCIAL_ID,
    });
    vi.mocked(deleteAccountSocial).mockResolvedValue(false);
    const res = await deleteArtistSocialHandler(request, ARTIST_ID, SOCIAL_ID);
    expect(res.status).toBe(500);
  });
});
