import { describe, it, expect, vi, beforeEach } from "vitest";
import { canAccessAccount } from "../canAccessAccount";

import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectAccountOrganizationIds } from "@/lib/supabase/account_organization_ids/selectAccountOrganizationIds";

// Mock RECOUP_ORG_ID constant
vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-admin-org-id",
}));

// Mock supabase libs
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

vi.mock("@/lib/supabase/account_organization_ids/selectAccountOrganizationIds", () => ({
  selectAccountOrganizationIds: vi.fn(),
}));

describe("canAccessAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Recoup admin organization", () => {
    it("returns true when orgId is RECOUP_ORG_ID (universal access)", async () => {
      const result = await canAccessAccount({
        orgId: "recoup-admin-org-id",
        targetAccountId: "any-account-123",
      });

      expect(result).toBe(true);
      // Should not query database for universal access
      expect(getAccountOrganizations).not.toHaveBeenCalled();
    });
  });

  describe("organization member access", () => {
    it("returns true when target account is a member of the organization", async () => {
      const orgId = "org-456";
      const targetAccountId = "member-account-789";

      // Mock getAccountOrganizations to return that the account IS a member
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        {
          account_id: targetAccountId,
          organization_id: orgId,
          created_at: new Date().toISOString(),
          organization: null,
        },
      ]);

      const result = await canAccessAccount({
        orgId,
        targetAccountId,
      });

      expect(result).toBe(true);
      expect(getAccountOrganizations).toHaveBeenCalledWith({
        accountId: targetAccountId,
        organizationId: orgId,
      });
    });

    it("returns false when target account is NOT a member of the organization", async () => {
      const orgId = "org-456";
      const targetAccountId = "non-member-account-999";

      // Mock getAccountOrganizations to return empty array (not a member)
      vi.mocked(getAccountOrganizations).mockResolvedValue([]);

      const result = await canAccessAccount({
        orgId,
        targetAccountId,
      });

      expect(result).toBe(false);
      expect(getAccountOrganizations).toHaveBeenCalledWith({
        accountId: targetAccountId,
        organizationId: orgId,
      });
    });
  });

  describe("shared org membership (orgId is null, currentAccountId provided)", () => {
    it("returns true when currentAccountId shares an org with targetAccountId", async () => {
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        {
          account_id: "account-123",
          organization_id: "shared-org",
          created_at: new Date().toISOString(),
          organization: null,
        },
      ]);
      vi.mocked(selectAccountOrganizationIds).mockResolvedValue([
        { organization_id: "shared-org" },
      ]);

      const result = await canAccessAccount({
        orgId: null,
        targetAccountId: "target-456",
        currentAccountId: "account-123",
      });

      expect(result).toBe(true);
      expect(getAccountOrganizations).toHaveBeenCalledWith({ accountId: "account-123" });
      expect(selectAccountOrganizationIds).toHaveBeenCalledWith("target-456", ["shared-org"]);
    });

    it("returns false when currentAccountId has no shared org with targetAccountId", async () => {
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        {
          account_id: "account-123",
          organization_id: "org-A",
          created_at: new Date().toISOString(),
          organization: null,
        },
      ]);
      vi.mocked(selectAccountOrganizationIds).mockResolvedValue([]);

      const result = await canAccessAccount({
        orgId: null,
        targetAccountId: "target-456",
        currentAccountId: "account-123",
      });

      expect(result).toBe(false);
    });

    it("returns false when currentAccountId belongs to no orgs", async () => {
      vi.mocked(getAccountOrganizations).mockResolvedValue([]);

      const result = await canAccessAccount({
        orgId: null,
        targetAccountId: "target-456",
        currentAccountId: "account-123",
      });

      expect(result).toBe(false);
      expect(selectAccountOrganizationIds).not.toHaveBeenCalled();
    });

    it("returns true when currentAccountId is in RECOUP_ORG (admin via shared org)", async () => {
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        {
          account_id: "admin-account",
          organization_id: "recoup-admin-org-id",
          created_at: new Date().toISOString(),
          organization: null,
        },
      ]);

      const result = await canAccessAccount({
        orgId: null,
        targetAccountId: "any-account",
        currentAccountId: "admin-account",
      });

      expect(result).toBe(true);
      expect(selectAccountOrganizationIds).not.toHaveBeenCalled();
    });
  });

  describe("invalid inputs", () => {
    it("returns false when orgId is null and no currentAccountId", async () => {
      const result = await canAccessAccount({
        orgId: null,
        targetAccountId: "account-123",
      });

      expect(result).toBe(false);
      expect(getAccountOrganizations).not.toHaveBeenCalled();
    });

    it("returns false when targetAccountId is empty", async () => {
      const result = await canAccessAccount({
        orgId: "org-456",
        targetAccountId: "",
      });

      expect(result).toBe(false);
      expect(getAccountOrganizations).not.toHaveBeenCalled();
    });

    it("returns false when both orgId and targetAccountId are invalid", async () => {
      const result = await canAccessAccount({
        orgId: null,
        targetAccountId: "",
      });

      expect(result).toBe(false);
    });
  });
});
