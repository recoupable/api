import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAccountArtistAccess } from "../checkAccountArtistAccess";

vi.mock("../selectAccountArtistId", () => ({
  selectAccountArtistId: vi.fn(),
}));

vi.mock("../../artist_organization_ids/selectArtistOrganizationIds", () => ({
  selectArtistOrganizationIds: vi.fn(),
}));

vi.mock("../../account_organization_ids/selectAccountOrganizationIds", () => ({
  selectAccountOrganizationIds: vi.fn(),
}));

import { selectAccountArtistId } from "../selectAccountArtistId";
import { selectArtistOrganizationIds } from "../../artist_organization_ids/selectArtistOrganizationIds";
import { selectAccountOrganizationIds } from "../../account_organization_ids/selectAccountOrganizationIds";

describe("checkAccountArtistAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([
      { organization_id: "org-1" },
    ]);
    vi.mocked(selectAccountOrganizationIds).mockResolvedValue([
      { organization_id: "org-1" },
    ]);

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
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([
      { organization_id: "org-1" },
    ]);
    vi.mocked(selectAccountOrganizationIds).mockResolvedValue(null);

    const result = await checkAccountArtistAccess("account-123", "artist-456");

    expect(result).toBe(false);
  });
});
