import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAccountArtistAccess } from "../checkAccountArtistAccess";

import { selectAccountArtistId } from "@/lib/supabase/account_artist_ids/selectAccountArtistId";
import { selectArtistOrganizationIds } from "@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds";
import { selectAccountOrganizationIds } from "@/lib/supabase/account_organization_ids/selectAccountOrganizationIds";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-admin-org-id",
}));

vi.mock("@/lib/supabase/account_artist_ids/selectAccountArtistId", () => ({
  selectAccountArtistId: vi.fn(),
}));

vi.mock("@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds", () => ({
  selectArtistOrganizationIds: vi.fn(),
}));

vi.mock("@/lib/supabase/account_organization_ids/selectAccountOrganizationIds", () => ({
  selectAccountOrganizationIds: vi.fn(),
}));

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

describe("checkAccountArtistAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccountOrganizations).mockResolvedValue([]);
  });

  it("should return true when account has direct access to artist", async () => {
    vi.mocked(selectAccountArtistId).mockResolvedValue({ artist_id: "artist-123" });

    const result = await checkAccountArtistAccess("account-123", "artist-123");

    expect(selectAccountArtistId).toHaveBeenCalledWith("account-123", "artist-123");
    expect(result).toBe(true);
    expect(selectArtistOrganizationIds).not.toHaveBeenCalled();
  });

  it("should return true when account and artist share an organization", async () => {
    vi.mocked(selectAccountArtistId).mockResolvedValue(null);
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([{ organization_id: "org-1" }]);
    vi.mocked(selectAccountOrganizationIds).mockResolvedValue([{ organization_id: "org-1" }]);

    const result = await checkAccountArtistAccess("account-123", "artist-456");

    expect(selectArtistOrganizationIds).toHaveBeenCalledWith("artist-456");
    expect(selectAccountOrganizationIds).toHaveBeenCalledWith("account-123", ["org-1"]);
    expect(result).toBe(true);
  });

  it("should return false when artist org lookup errors (fail closed)", async () => {
    vi.mocked(selectAccountArtistId).mockResolvedValue(null);
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue(null);

    const result = await checkAccountArtistAccess("account-123", "artist-123");

    expect(result).toBe(false);
  });

  it("should return false when account has no access", async () => {
    vi.mocked(selectAccountArtistId).mockResolvedValue(null);
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([]);

    const result = await checkAccountArtistAccess("account-123", "artist-456");

    expect(result).toBe(false);
    expect(selectAccountOrganizationIds).not.toHaveBeenCalled();
  });

  it("should return false when account org lookup errors (fail closed)", async () => {
    vi.mocked(selectAccountArtistId).mockResolvedValue(null);
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([{ organization_id: "org-1" }]);
    vi.mocked(selectAccountOrganizationIds).mockResolvedValue(null);

    const result = await checkAccountArtistAccess("account-123", "artist-456");

    expect(result).toBe(false);
  });

  describe("admin bypass", () => {
    it("should return true for admin accounts regardless of artist membership", async () => {
      vi.mocked(selectAccountArtistId).mockResolvedValue(null);
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        {
          account_id: "admin-account",
          organization_id: "recoup-admin-org-id",
          created_at: new Date().toISOString(),
          organization: null,
        },
      ]);

      const result = await checkAccountArtistAccess("admin-account", "any-artist");

      expect(result).toBe(true);
      expect(selectArtistOrganizationIds).not.toHaveBeenCalled();
      expect(selectAccountOrganizationIds).not.toHaveBeenCalled();
    });

    it("should not grant access to non-admin accounts with no artist membership", async () => {
      vi.mocked(selectAccountArtistId).mockResolvedValue(null);
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        {
          account_id: "account-123",
          organization_id: "some-other-org",
          created_at: new Date().toISOString(),
          organization: null,
        },
      ]);
      vi.mocked(selectArtistOrganizationIds).mockResolvedValue([]);

      const result = await checkAccountArtistAccess("account-123", "artist-456");

      expect(result).toBe(false);
    });
  });
});
