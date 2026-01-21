import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelectAccountSocials = vi.fn();
const mockDeleteAccountSocial = vi.fn();
const mockInsertAccountSocial = vi.fn();
const mockSelectSocials = vi.fn();
const mockInsertSocials = vi.fn();

vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: (...args: unknown[]) => mockSelectAccountSocials(...args),
}));

vi.mock("@/lib/supabase/account_socials/deleteAccountSocial", () => ({
  deleteAccountSocial: (...args: unknown[]) => mockDeleteAccountSocial(...args),
}));

vi.mock("@/lib/supabase/account_socials/insertAccountSocial", () => ({
  insertAccountSocial: (...args: unknown[]) => mockInsertAccountSocial(...args),
}));

vi.mock("@/lib/supabase/socials/selectSocials", () => ({
  selectSocials: (...args: unknown[]) => mockSelectSocials(...args),
}));

vi.mock("@/lib/supabase/socials/insertSocials", () => ({
  insertSocials: (...args: unknown[]) => mockInsertSocials(...args),
}));

import { updateArtistSocials } from "../updateArtistSocials";

describe("updateArtistSocials", () => {
  const artistId = "artist-123";

  const existingTwitterSocial = {
    id: "account-social-1",
    account_id: artistId,
    social_id: "social-twitter-1",
    social: {
      id: "social-twitter-1",
      username: "oldartist",
      profile_url: "twitter.com/oldartist",
    },
  };

  const existingInstagramSocial = {
    id: "account-social-2",
    account_id: artistId,
    social_id: "social-instagram-1",
    social: {
      id: "social-instagram-1",
      username: "oldartist",
      profile_url: "instagram.com/oldartist",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not delete existing socials when empty URL is provided for a platform", async () => {
    // Setup: Artist has existing Twitter social
    mockSelectAccountSocials.mockResolvedValue([existingTwitterSocial]);

    await updateArtistSocials(artistId, { TWITTER: "" });

    // Should NOT delete the existing Twitter social since no replacement is provided
    expect(mockDeleteAccountSocial).not.toHaveBeenCalled();
  });

  it("does not delete socials for platforms not included in profileUrls", async () => {
    // Setup: Artist has both Twitter and Instagram
    mockSelectAccountSocials.mockResolvedValue([existingTwitterSocial, existingInstagramSocial]);
    mockSelectSocials.mockResolvedValue([]);
    mockInsertSocials.mockResolvedValue([
      { id: "new-social-1", username: "newartist", profile_url: "twitter.com/newartist" },
    ]);

    // Only update Twitter, not Instagram
    await updateArtistSocials(artistId, { TWITTER: "https://twitter.com/newartist" });

    // Should only delete Twitter, not Instagram
    expect(mockDeleteAccountSocial).toHaveBeenCalledTimes(1);
    expect(mockDeleteAccountSocial).toHaveBeenCalledWith(artistId, "social-twitter-1");
    expect(mockDeleteAccountSocial).not.toHaveBeenCalledWith(artistId, "social-instagram-1");
  });

  it("replaces existing social when valid URL is provided", async () => {
    mockSelectAccountSocials.mockResolvedValue([existingTwitterSocial]);
    mockSelectSocials.mockResolvedValue([]);
    mockInsertSocials.mockResolvedValue([
      { id: "new-social-1", username: "newartist", profile_url: "twitter.com/newartist" },
    ]);

    await updateArtistSocials(artistId, { TWITTER: "https://twitter.com/newartist" });

    // Should delete old and insert new
    expect(mockDeleteAccountSocial).toHaveBeenCalledWith(artistId, "social-twitter-1");
    expect(mockInsertAccountSocial).toHaveBeenCalledWith(artistId, "new-social-1");
  });

  it("adds new social when no existing social for platform", async () => {
    mockSelectAccountSocials.mockResolvedValue([]);
    mockSelectSocials.mockResolvedValue([]);
    mockInsertSocials.mockResolvedValue([
      { id: "new-social-1", username: "artist", profile_url: "twitter.com/artist" },
    ]);

    await updateArtistSocials(artistId, { TWITTER: "https://twitter.com/artist" });

    expect(mockDeleteAccountSocial).not.toHaveBeenCalled();
    expect(mockInsertAccountSocial).toHaveBeenCalledWith(artistId, "new-social-1");
  });

  it("uses existing social record if profile_url already exists in database", async () => {
    const existingSocialInDb = {
      id: "existing-db-social",
      username: "artist",
      profile_url: "twitter.com/artist",
    };
    mockSelectAccountSocials.mockResolvedValue([]);
    mockSelectSocials.mockResolvedValue([existingSocialInDb]);

    await updateArtistSocials(artistId, { TWITTER: "https://twitter.com/artist" });

    // Should not create new social, just link existing one
    expect(mockInsertSocials).not.toHaveBeenCalled();
    expect(mockInsertAccountSocial).toHaveBeenCalledWith(artistId, "existing-db-social");
  });
});
