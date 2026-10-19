import { describe, it, expect, vi, beforeEach } from "vitest";
import { isArtistAccount } from "../isArtistAccount";
import { selectArtistOwnerLink } from "@/lib/supabase/account_artist_ids/selectArtistOwnerLink";
import { selectArtistOrganizationIds } from "@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds";

vi.mock("@/lib/supabase/account_artist_ids/selectArtistOwnerLink", () => ({
  selectArtistOwnerLink: vi.fn(),
}));
vi.mock("@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds", () => ({
  selectArtistOrganizationIds: vi.fn(),
}));

describe("isArtistAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectArtistOwnerLink).mockResolvedValue(null);
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([]);
  });

  it("is true when an account holds the id as an artist", async () => {
    vi.mocked(selectArtistOwnerLink).mockResolvedValue({ account_id: "owner" });
    await expect(isArtistAccount("a")).resolves.toBe(true);
  });

  it("is true when an organization holds the id as an artist", async () => {
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([{ organization_id: "org" }]);
    await expect(isArtistAccount("a")).resolves.toBe(true);
  });

  it("is false for an account that is no one's artist", async () => {
    await expect(isArtistAccount("a")).resolves.toBe(false);
  });

  it("throws when the organization lookup fails, instead of guessing", async () => {
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue(null);
    await expect(isArtistAccount("a")).rejects.toThrow();
  });
});
