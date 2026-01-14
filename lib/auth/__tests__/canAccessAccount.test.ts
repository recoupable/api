import { describe, it, expect, vi, beforeEach } from "vitest";
import { canAccessAccount } from "../canAccessAccount";

// Mock RECOUP_ORG_ID constant
vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-admin-org-id",
}));

// Mock supabase client
vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(),
          })),
        })),
      })),
    })),
  },
}));

import supabase from "@/lib/supabase/serverClient";

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
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe("organization member access", () => {
    it("returns true when target account is a member of the organization", async () => {
      const orgId = "org-456";
      const targetAccountId = "member-account-789";

      // Mock supabase to return that the account IS a member
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: { account_id: targetAccountId, organization_id: orgId },
        error: null,
      });
      const mockEqOrg = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEqAccount = vi.fn().mockReturnValue({ eq: mockEqOrg });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqAccount });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const result = await canAccessAccount({
        orgId,
        targetAccountId,
      });

      expect(result).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith("account_organization_ids");
    });

    it("returns false when target account is NOT a member of the organization", async () => {
      const orgId = "org-456";
      const targetAccountId = "non-member-account-999";

      // Mock supabase to return no match (not a member)
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockEqOrg = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEqAccount = vi.fn().mockReturnValue({ eq: mockEqOrg });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqAccount });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const result = await canAccessAccount({
        orgId,
        targetAccountId,
      });

      expect(result).toBe(false);
    });
  });

  describe("invalid inputs", () => {
    it("returns false when orgId is null", async () => {
      const result = await canAccessAccount({
        orgId: null,
        targetAccountId: "account-123",
      });

      expect(result).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("returns false when targetAccountId is empty", async () => {
      const result = await canAccessAccount({
        orgId: "org-456",
        targetAccountId: "",
      });

      expect(result).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("returns false when both orgId and targetAccountId are invalid", async () => {
      const result = await canAccessAccount({
        orgId: null,
        targetAccountId: "",
      });

      expect(result).toBe(false);
    });
  });

  describe("error handling", () => {
    it("returns false when database query throws an error", async () => {
      const orgId = "org-456";
      const targetAccountId = "account-123";

      // Mock supabase to return an error
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });
      const mockEqOrg = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEqAccount = vi.fn().mockReturnValue({ eq: mockEqOrg });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqAccount });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const result = await canAccessAccount({
        orgId,
        targetAccountId,
      });

      expect(result).toBe(false);
    });
  });
});
