import { describe, it, expect, vi, beforeEach } from "vitest";
import { canAccessAccount } from "../canAccessAccount";

import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

// Mock RECOUP_ORG_ID constant
vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-admin-org-id",
}));

// Mock getAccountOrganizations supabase lib
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
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

  describe("invalid inputs", () => {
    it("returns false when orgId is null", async () => {
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
