import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAccountAccess } from "../checkAccountAccess";

import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";

vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));

describe("checkAccountAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    vi.mocked(validateOrganizationAccess).mockResolvedValue(false);
  });

  it("grants self access without any database calls", async () => {
    const result = await checkAccountAccess("account-123", "account-123");

    expect(result).toEqual({ hasAccess: true, entityType: "self" });
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
    expect(validateOrganizationAccess).not.toHaveBeenCalled();
  });

  it("grants artist access when the caller manages the target", async () => {
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);

    const result = await checkAccountAccess("account-123", "artist-456");

    expect(checkAccountArtistAccess).toHaveBeenCalledWith("account-123", "artist-456");
    expect(result).toEqual({ hasAccess: true, entityType: "artist" });
  });

  it("grants organization access when the caller is a member", async () => {
    vi.mocked(validateOrganizationAccess).mockResolvedValue(true);

    const result = await checkAccountAccess("account-123", "org-789");

    expect(validateOrganizationAccess).toHaveBeenCalledWith({
      accountId: "account-123",
      organizationId: "org-789",
    });
    expect(result).toEqual({ hasAccess: true, entityType: "organization" });
  });

  it("denies a workspace pair — account_workspace_ids no longer grants access", async () => {
    // Workspaces are removed as an account type (chat#1979): no access path
    // reads account_workspace_ids, so a lingering join row cannot grant access.
    const result = await checkAccountAccess("account-123", "workspace-789");

    expect(result).toEqual({ hasAccess: false });
  });

  it("denies when no access path matches", async () => {
    const result = await checkAccountAccess("account-123", "stranger-000");

    expect(result).toEqual({ hasAccess: false });
  });
});
