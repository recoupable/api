import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateOrganizationAccess } from "../validateOrganizationAccess";

import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

// Mock getAccountOrganizations supabase lib
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

const mockGetAccountOrganizations = vi.mocked(getAccountOrganizations);

describe("validateOrganizationAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("account is the organization", () => {
    it("returns true when accountId equals organizationId", async () => {
      const result = await validateOrganizationAccess({
        accountId: "org-123",
        organizationId: "org-123",
      });

      expect(result).toBe(true);
      // Should not query database when account IS the org
      expect(mockGetAccountOrganizations).not.toHaveBeenCalled();
    });
  });

  describe("account is a member of the organization", () => {
    it("returns true when account is a member of the organization", async () => {
      mockGetAccountOrganizations.mockResolvedValue([
        {
          account_id: "member-account-456",
          organization_id: "org-123",
          created_at: new Date().toISOString(),
          organization: null,
        },
      ]);

      const result = await validateOrganizationAccess({
        accountId: "member-account-456",
        organizationId: "org-123",
      });

      expect(result).toBe(true);
      expect(mockGetAccountOrganizations).toHaveBeenCalledWith({
        accountId: "member-account-456",
        organizationId: "org-123",
      });
    });

    it("returns false when account is NOT a member of the organization", async () => {
      mockGetAccountOrganizations.mockResolvedValue([]);

      const result = await validateOrganizationAccess({
        accountId: "non-member-account-789",
        organizationId: "org-123",
      });

      expect(result).toBe(false);
      expect(mockGetAccountOrganizations).toHaveBeenCalledWith({
        accountId: "non-member-account-789",
        organizationId: "org-123",
      });
    });
  });

  describe("invalid inputs", () => {
    it("returns false when accountId is empty", async () => {
      const result = await validateOrganizationAccess({
        accountId: "",
        organizationId: "org-123",
      });

      expect(result).toBe(false);
      expect(mockGetAccountOrganizations).not.toHaveBeenCalled();
    });

    it("returns false when organizationId is empty", async () => {
      const result = await validateOrganizationAccess({
        accountId: "account-123",
        organizationId: "",
      });

      expect(result).toBe(false);
      expect(mockGetAccountOrganizations).not.toHaveBeenCalled();
    });

    it("returns false when both are empty", async () => {
      const result = await validateOrganizationAccess({
        accountId: "",
        organizationId: "",
      });

      expect(result).toBe(false);
      expect(mockGetAccountOrganizations).not.toHaveBeenCalled();
    });
  });
});
