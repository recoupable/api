import { describe, it, expect, vi, beforeEach } from "vitest";
import { isOrganization } from "../isOrganization";

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
    })),
  },
}));

import supabase from "@/lib/supabase/serverClient";

describe("isOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("valid organization", () => {
    it("returns true when accountId is an organization", async () => {
      const orgId = "org-123";

      const mockMaybeSingle = vi
        .fn()
        .mockResolvedValue({ data: { organization_id: orgId }, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const result = await isOrganization(orgId);

      expect(result).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith("account_organization_ids");
      expect(mockSelect).toHaveBeenCalledWith("organization_id");
      expect(mockEq).toHaveBeenCalledWith("organization_id", orgId);
    });
  });

  describe("not an organization", () => {
    it("returns false when accountId is not an organization", async () => {
      const personalAccountId = "personal-123";

      const mockMaybeSingle = vi
        .fn()
        .mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const result = await isOrganization(personalAccountId);

      expect(result).toBe(false);
    });
  });

  describe("invalid inputs", () => {
    it("returns false for empty accountId", async () => {
      const result = await isOrganization("");

      expect(result).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("returns false for null accountId", async () => {
      const result = await isOrganization(null as unknown as string);

      expect(result).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("returns false for undefined accountId", async () => {
      const result = await isOrganization(undefined as unknown as string);

      expect(result).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("returns false when database query fails", async () => {
      const orgId = "org-123";

      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const result = await isOrganization(orgId);

      expect(result).toBe(false);
    });
  });
});
