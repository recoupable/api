import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { updateArtistHandler } from "../updateArtistHandler";
import { validateUpdateArtistRequest } from "../validateUpdateArtistRequest";
import { updateAccount } from "@/lib/supabase/accounts/updateAccount";
import { selectAccountInfo } from "@/lib/supabase/account_info/selectAccountInfo";
import { insertAccountInfo } from "@/lib/supabase/account_info/insertAccountInfo";
import { updateAccountInfo } from "@/lib/supabase/account_info/updateAccountInfo";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";
import { selectAccountWithArtistDetails } from "@/lib/supabase/accounts/selectAccountWithArtistDetails";
import { selectAccountArtistId } from "@/lib/supabase/account_artist_ids/selectAccountArtistId";
import { setAccountArtistPin } from "@/lib/artists/setAccountArtistPin";
import { upsertArtistInfoFields } from "@/lib/artists/upsertArtistInfoFields";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateUpdateArtistRequest", () => ({
  validateUpdateArtistRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/updateAccount", () => ({
  updateAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/account_info/selectAccountInfo", () => ({
  selectAccountInfo: vi.fn(),
}));

vi.mock("@/lib/supabase/account_info/insertAccountInfo", () => ({
  insertAccountInfo: vi.fn(),
}));

vi.mock("@/lib/supabase/account_info/updateAccountInfo", () => ({
  updateAccountInfo: vi.fn(),
}));

vi.mock("@/lib/artist/updateArtistSocials", () => ({
  updateArtistSocials: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/selectAccountWithArtistDetails", () => ({
  selectAccountWithArtistDetails: vi.fn(),
}));

vi.mock("@/lib/supabase/account_artist_ids/selectAccountArtistId", () => ({
  selectAccountArtistId: vi.fn(),
}));

vi.mock("@/lib/artists/setAccountArtistPin", () => ({
  setAccountArtistPin: vi.fn(),
}));

vi.mock("@/lib/artists/upsertArtistInfoFields", () => ({
  upsertArtistInfoFields: vi.fn(),
}));

describe("updateArtistHandler", () => {
  const artistId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the validation response when validation fails", async () => {
    const validationError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateUpdateArtistRequest).mockResolvedValue(validationError);

    const request = new NextRequest(`http://localhost/api/artists/${artistId}`, {
      method: "PATCH",
    });

    const response = await updateArtistHandler(request, Promise.resolve({ id: artistId }));

    expect(response).toBe(validationError);
  });

  it("updates the artist and returns the merged artist payload", async () => {
    vi.mocked(validateUpdateArtistRequest).mockResolvedValue({
      artistId,
      requesterAccountId: "660e8400-e29b-41d4-a716-446655440000",
      name: "Updated Artist",
      image: "https://example.com/new-image.jpg",
      instruction: "Stay on brand",
      label: "",
      knowledges: [
        {
          name: "Press Kit",
          url: "https://example.com/press-kit.pdf",
          type: "application/pdf",
        },
      ],
      profileUrls: {
        INSTAGRAM: "https://instagram.com/updated_artist",
      },
    });
    vi.mocked(selectAccountInfo).mockResolvedValue({
      account_id: artistId,
      image: "https://example.com/old-image.jpg",
      instruction: "Old instruction",
      knowledges: [],
      label: "Old label",
    } as never);
    vi.mocked(selectAccountWithArtistDetails).mockResolvedValue({
      id: artistId,
      name: "Updated Artist",
      account_info: [
        {
          account_id: artistId,
          image: "https://example.com/new-image.jpg",
          instruction: "Stay on brand",
          knowledges: [
            {
              name: "Press Kit",
              url: "https://example.com/press-kit.pdf",
              type: "application/pdf",
            },
          ],
          label: null,
        },
      ],
      account_socials: [
        {
          id: "account-social-1",
          account_id: artistId,
          social_id: "social-1",
          social: {
            id: "social-1",
            username: "updated_artist",
            profile_url: "https://instagram.com/updated_artist",
          },
        },
      ],
    } as never);

    const request = new NextRequest(`http://localhost/api/artists/${artistId}`, {
      method: "PATCH",
    });

    const response = await updateArtistHandler(request, Promise.resolve({ id: artistId }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateAccount).toHaveBeenCalledWith(artistId, { name: "Updated Artist" });
    expect(upsertArtistInfoFields).toHaveBeenCalledWith({
      artistId,
      image: "https://example.com/new-image.jpg",
      instruction: "Stay on brand",
      knowledges: [
        {
          name: "Press Kit",
          url: "https://example.com/press-kit.pdf",
          type: "application/pdf",
        },
      ],
      label: "",
    });
    expect(updateArtistSocials).toHaveBeenCalledWith(artistId, {
      INSTAGRAM: "https://instagram.com/updated_artist",
    });
    expect(body.artist).toEqual({
      account_id: artistId,
      name: "Updated Artist",
      image: "https://example.com/new-image.jpg",
      instruction: "Stay on brand",
      knowledges: [
        {
          name: "Press Kit",
          url: "https://example.com/press-kit.pdf",
          type: "application/pdf",
        },
      ],
      label: null,
      account_socials: [
        {
          id: "social-1",
          profile_url: "https://instagram.com/updated_artist",
          username: "updated_artist",
          link: "https://instagram.com/updated_artist",
          type: "INSTAGRAM",
        },
      ],
      pinned: false,
    });
  });

  it("preserves an already-pinned artist when only the name is updated (regression)", async () => {
    const requesterAccountId = "660e8400-e29b-41d4-a716-446655440000";
    vi.mocked(validateUpdateArtistRequest).mockResolvedValue({
      artistId,
      requesterAccountId,
      name: "Renamed Only",
    });
    vi.mocked(selectAccountInfo).mockResolvedValue({
      account_id: artistId,
      image: null,
      instruction: null,
      knowledges: null,
      label: null,
    } as never);
    vi.mocked(selectAccountWithArtistDetails).mockResolvedValue({
      id: artistId,
      name: "Renamed Only",
      account_info: [
        {
          account_id: artistId,
          image: null,
          instruction: null,
          knowledges: null,
          label: null,
        },
      ],
      account_socials: [],
    } as never);
    vi.mocked(selectAccountArtistId).mockResolvedValue({
      artist_id: artistId,
      pinned: true,
    } as never);

    const request = new NextRequest(`http://localhost/api/artists/${artistId}`, {
      method: "PATCH",
    });

    const response = await updateArtistHandler(request, Promise.resolve({ id: artistId }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(setAccountArtistPin).not.toHaveBeenCalled();
    expect(selectAccountWithArtistDetails).toHaveBeenCalledWith(artistId);
    expect(selectAccountArtistId).toHaveBeenCalledWith(requesterAccountId, artistId);
    expect(body.artist.pinned).toBe(true);
  });

  it("persists pin state via setAccountArtistPin when pinned is provided", async () => {
    const requesterAccountId = "660e8400-e29b-41d4-a716-446655440000";
    vi.mocked(validateUpdateArtistRequest).mockResolvedValue({
      artistId,
      requesterAccountId,
      pinned: true,
    });
    vi.mocked(selectAccountInfo).mockResolvedValue({
      account_id: artistId,
      image: null,
      instruction: null,
      knowledges: null,
      label: null,
    } as never);
    vi.mocked(selectAccountWithArtistDetails).mockResolvedValue({
      id: artistId,
      name: "Artist",
      account_info: [],
      account_socials: [],
    } as never);
    vi.mocked(selectAccountArtistId).mockResolvedValue({
      artist_id: artistId,
      pinned: true,
    } as never);

    const request = new NextRequest(`http://localhost/api/artists/${artistId}`, {
      method: "PATCH",
    });

    const response = await updateArtistHandler(request, Promise.resolve({ id: artistId }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(setAccountArtistPin).toHaveBeenCalledWith({
      accountId: requesterAccountId,
      artistId,
      pinned: true,
    });
    expect(body.artist.pinned).toBe(true);
  });

  it("writes pinned: false when explicitly unpinning", async () => {
    const requesterAccountId = "660e8400-e29b-41d4-a716-446655440000";
    vi.mocked(validateUpdateArtistRequest).mockResolvedValue({
      artistId,
      requesterAccountId,
      pinned: false,
    });
    vi.mocked(selectAccountInfo).mockResolvedValue({
      account_id: artistId,
      image: null,
      instruction: null,
      knowledges: null,
      label: null,
    } as never);
    vi.mocked(selectAccountWithArtistDetails).mockResolvedValue({
      id: artistId,
      name: "Artist",
      account_info: [],
      account_socials: [],
    } as never);
    vi.mocked(selectAccountArtistId).mockResolvedValue({
      artist_id: artistId,
      pinned: false,
    } as never);

    const request = new NextRequest(`http://localhost/api/artists/${artistId}`, {
      method: "PATCH",
    });

    await updateArtistHandler(request, Promise.resolve({ id: artistId }));

    expect(setAccountArtistPin).toHaveBeenCalledWith({
      accountId: requesterAccountId,
      artistId,
      pinned: false,
    });
  });

  it("inserts account_info when the artist does not have one yet", async () => {
    vi.mocked(validateUpdateArtistRequest).mockResolvedValue({
      artistId,
      requesterAccountId: "660e8400-e29b-41d4-a716-446655440000",
      instruction: "New profile",
    });
    vi.mocked(selectAccountInfo).mockResolvedValue(null);
    vi.mocked(selectAccountWithArtistDetails).mockResolvedValue({
      id: artistId,
      name: "Artist",
      account_info: [
        {
          account_id: artistId,
          image: null,
          instruction: "New profile",
          knowledges: null,
          label: null,
        },
      ],
      account_socials: [],
    } as never);

    const request = new NextRequest(`http://localhost/api/artists/${artistId}`, {
      method: "PATCH",
    });

    const response = await updateArtistHandler(request, Promise.resolve({ id: artistId }));

    expect(response.status).toBe(200);
    expect(upsertArtistInfoFields).toHaveBeenCalledWith({
      artistId,
      image: undefined,
      instruction: "New profile",
      knowledges: undefined,
      label: undefined,
    });
  });
});
