import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkConnectorAuthority } from "../checkConnectorAuthority";

import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectArtistOrganizationIds } from "@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds";
import { selectAccountOrganizationIds } from "@/lib/supabase/account_organization_ids/selectAccountOrganizationIds";
import { selectAccountWorkspaceId } from "@/lib/supabase/account_workspace_ids/selectAccountWorkspaceId";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { selectAccountArtistId } from "@/lib/supabase/account_artist_ids/selectAccountArtistId";

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-admin-org-id",
}));

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

vi.mock("@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds", () => ({
  selectArtistOrganizationIds: vi.fn(),
}));

vi.mock("@/lib/supabase/account_organization_ids/selectAccountOrganizationIds", () => ({
  selectAccountOrganizationIds: vi.fn(),
}));

vi.mock("@/lib/supabase/account_workspace_ids/selectAccountWorkspaceId", () => ({
  selectAccountWorkspaceId: vi.fn(),
}));

vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/account_artist_ids/selectAccountArtistId", () => ({
  selectAccountArtistId: vi.fn(),
}));

describe("checkConnectorAuthority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccountOrganizations).mockResolvedValue([]);
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([]);
    vi.mocked(selectAccountOrganizationIds).mockResolvedValue([]);
    vi.mocked(selectAccountWorkspaceId).mockResolvedValue(null);
    vi.mocked(validateOrganizationAccess).mockResolvedValue(false);
  });

  it("grants self access without any database calls", async () => {
    const result = await checkConnectorAuthority("account-123", "account-123");

    expect(result).toBe(true);
    expect(getAccountOrganizations).not.toHaveBeenCalled();
    expect(selectArtistOrganizationIds).not.toHaveBeenCalled();
  });

  it("denies a roster-only manager (bare account_artist_ids row, no org tie)", async () => {
    // Even if a roster row exists, connector authority must never read it.
    vi.mocked(selectAccountArtistId).mockResolvedValue({
      id: "aai-1",
      artist_id: "artist-456",
      pinned: false,
    });

    const result = await checkConnectorAuthority("account-123", "artist-456");

    expect(result).toBe(false);
    expect(selectAccountArtistId).not.toHaveBeenCalled();
  });

  it("grants access when caller and artist share an organization", async () => {
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([{ organization_id: "org-1" }]);
    vi.mocked(selectAccountOrganizationIds).mockResolvedValue([{ organization_id: "org-1" }]);

    const result = await checkConnectorAuthority("account-123", "artist-456");

    expect(selectArtistOrganizationIds).toHaveBeenCalledWith("artist-456");
    expect(selectAccountOrganizationIds).toHaveBeenCalledWith("account-123", ["org-1"]);
    expect(result).toBe(true);
  });

  it("grants RECOUP_ORG staff access to any target", async () => {
    vi.mocked(getAccountOrganizations).mockResolvedValue([
      {
        id: "aoi-1",
        account_id: "admin-account",
        organization_id: "recoup-admin-org-id",
        updated_at: null,
        organization: null,
      },
    ]);

    const result = await checkConnectorAuthority("admin-account", "artist-456");

    expect(result).toBe(true);
    expect(selectArtistOrganizationIds).not.toHaveBeenCalled();
  });

  it("grants access to a workspace the caller owns", async () => {
    vi.mocked(selectAccountWorkspaceId).mockResolvedValue({ workspace_id: "workspace-789" });

    const result = await checkConnectorAuthority("account-123", "workspace-789");

    expect(selectAccountWorkspaceId).toHaveBeenCalledWith("account-123", "workspace-789");
    expect(result).toBe(true);
  });

  it("grants access to an organization the caller belongs to", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(true);

    const result = await checkConnectorAuthority("account-123", "org-target");

    expect(validateOrganizationAccess).toHaveBeenCalledWith({
      accountId: "account-123",
      organizationId: "org-target",
    });
    expect(result).toBe(true);
  });

  it("fails closed when artist org lookup errors", async () => {
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue(null);

    const result = await checkConnectorAuthority("account-123", "artist-456");

    expect(result).toBe(false);
  });

  it("fails closed when account org lookup errors", async () => {
    vi.mocked(selectArtistOrganizationIds).mockResolvedValue([{ organization_id: "org-1" }]);
    vi.mocked(selectAccountOrganizationIds).mockResolvedValue(null);

    const result = await checkConnectorAuthority("account-123", "artist-456");

    expect(result).toBe(false);
  });
});
