import { describe, it, expect, vi, beforeEach } from "vitest";
import { canAccessAccountViaAnyOrg } from "../canAccessAccountViaAnyOrg";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectAccountOrganizationIds } from "@/lib/supabase/account_organization_ids/selectAccountOrganizationIds";

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

vi.mock("@/lib/supabase/account_organization_ids/selectAccountOrganizationIds", () => ({
  selectAccountOrganizationIds: vi.fn(),
}));

const mockGetAccountOrganizations = vi.mocked(getAccountOrganizations);
const mockSelectAccountOrganizationIds = vi.mocked(selectAccountOrganizationIds);

describe("canAccessAccountViaAnyOrg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when currentAccountId has no org memberships", async () => {
    mockGetAccountOrganizations.mockResolvedValue([]);

    const result = await canAccessAccountViaAnyOrg({
      currentAccountId: "account-123",
      targetAccountId: "account-456",
    });

    expect(result).toBe(false);
    expect(mockSelectAccountOrganizationIds).not.toHaveBeenCalled();
  });

  it("returns true when targetAccountId is in an org the currentAccountId belongs to", async () => {
    mockGetAccountOrganizations.mockResolvedValue([
      { organization_id: "org-111", account_id: "account-123", organization: null } as never,
      { organization_id: "org-222", account_id: "account-123", organization: null } as never,
    ]);
    mockSelectAccountOrganizationIds.mockResolvedValue([{ organization_id: "org-111" }] as never);

    const result = await canAccessAccountViaAnyOrg({
      currentAccountId: "account-123",
      targetAccountId: "account-456",
    });

    expect(result).toBe(true);
    expect(mockGetAccountOrganizations).toHaveBeenCalledWith({ accountId: "account-123" });
    expect(mockSelectAccountOrganizationIds).toHaveBeenCalledWith("account-456", [
      "org-111",
      "org-222",
    ]);
  });

  it("returns false when targetAccountId is not in any of currentAccountId's orgs", async () => {
    mockGetAccountOrganizations.mockResolvedValue([
      { organization_id: "org-111", account_id: "account-123", organization: null } as never,
    ]);
    mockSelectAccountOrganizationIds.mockResolvedValue([]);

    const result = await canAccessAccountViaAnyOrg({
      currentAccountId: "account-123",
      targetAccountId: "account-456",
    });

    expect(result).toBe(false);
  });

  it("returns false when selectAccountOrganizationIds returns null (DB error)", async () => {
    mockGetAccountOrganizations.mockResolvedValue([
      { organization_id: "org-111", account_id: "account-123", organization: null } as never,
    ]);
    mockSelectAccountOrganizationIds.mockResolvedValue(null);

    const result = await canAccessAccountViaAnyOrg({
      currentAccountId: "account-123",
      targetAccountId: "account-456",
    });

    expect(result).toBe(false);
  });
});
