import { describe, it, expect, vi, beforeEach } from "vitest";
import { canAccessAccount } from "../canAccessAccount";

import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectAccountOrganizationIds } from "@/lib/supabase/account_organization_ids/selectAccountOrganizationIds";

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-admin-org-id",
}));

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

  describe("self-access", () => {
    it("returns true when currentAccountId equals targetAccountId", async () => {
      const result = await canAccessAccount({
        currentAccountId: "account-123",
        targetAccountId: "account-123",
      });

      expect(result).toBe(true);
      expect(getAccountOrganizations).not.toHaveBeenCalled();
    });
  });

  describe("shared org membership", () => {
    it("returns true when accounts share an org", async () => {
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
        currentAccountId: "account-123",
        targetAccountId: "target-456",
      });

      expect(result).toBe(true);
      expect(getAccountOrganizations).toHaveBeenCalledWith({
        accountId: "account-123",
      });
      expect(selectAccountOrganizationIds).toHaveBeenCalledWith("target-456", ["shared-org"]);
    });

    it("returns false when accounts do not share an org", async () => {
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
        currentAccountId: "account-123",
        targetAccountId: "target-456",
      });

      expect(result).toBe(false);
    });

    it("returns false when currentAccountId belongs to no orgs", async () => {
      vi.mocked(getAccountOrganizations).mockResolvedValue([]);

      const result = await canAccessAccount({
        currentAccountId: "account-123",
        targetAccountId: "target-456",
      });

      expect(result).toBe(false);
      expect(selectAccountOrganizationIds).not.toHaveBeenCalled();
    });
  });

  describe("admin bypass", () => {
    it("returns true when currentAccountId is in RECOUP_ORG", async () => {
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        {
          account_id: "admin-account",
          organization_id: "recoup-admin-org-id",
          created_at: new Date().toISOString(),
          organization: null,
        },
      ]);

      const result = await canAccessAccount({
        currentAccountId: "admin-account",
        targetAccountId: "any-account",
      });

      expect(result).toBe(true);
      expect(selectAccountOrganizationIds).not.toHaveBeenCalled();
    });
  });

  describe("invalid inputs", () => {
    it("returns false when targetAccountId is empty", async () => {
      const result = await canAccessAccount({
        currentAccountId: "account-123",
        targetAccountId: "",
      });

      expect(result).toBe(false);
      expect(getAccountOrganizations).not.toHaveBeenCalled();
    });

    it("returns false when currentAccountId is empty", async () => {
      const result = await canAccessAccount({
        currentAccountId: "",
        targetAccountId: "account-123",
      });

      expect(result).toBe(false);
      expect(getAccountOrganizations).not.toHaveBeenCalled();
    });
  });
});
