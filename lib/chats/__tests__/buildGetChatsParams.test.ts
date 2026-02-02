import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGetChatsParams } from "../buildGetChatsParams";

import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(),
}));

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-org-id",
}));

describe("buildGetChatsParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("personal API key (org_id = null)", () => {
    it("returns account_ids with key owner when no target_account_id", async () => {
      const result = await buildGetChatsParams({
        account_id: "account-123",
        org_id: null,
      });

      expect(result).toEqual({
        params: { account_ids: ["account-123"], artist_id: undefined },
        error: null,
      });
    });

    it("returns error when personal key tries to filter by account_id", async () => {
      vi.mocked(canAccessAccount).mockResolvedValue(false);

      const result = await buildGetChatsParams({
        account_id: "account-123",
        org_id: null,
        target_account_id: "other-account",
      });

      expect(result).toEqual({
        params: null,
        error: "Personal API keys cannot filter by account_id",
      });
    });

    it("includes artist_id filter for personal key", async () => {
      const result = await buildGetChatsParams({
        account_id: "account-123",
        org_id: null,
        artist_id: "artist-456",
      });

      expect(result).toEqual({
        params: { account_ids: ["account-123"], artist_id: "artist-456" },
        error: null,
      });
    });
  });

  describe("organization API key", () => {
    it("fetches org member account_ids when no target_account_id", async () => {
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        { account_id: "member-1", organization_id: "org-123", organization: null },
        { account_id: "member-2", organization_id: "org-123", organization: null },
        { account_id: "member-3", organization_id: "org-123", organization: null },
      ]);

      const result = await buildGetChatsParams({
        account_id: "org-123",
        org_id: "org-123",
      });

      expect(getAccountOrganizations).toHaveBeenCalledWith({ organizationId: "org-123" });
      expect(result).toEqual({
        params: { account_ids: ["member-1", "member-2", "member-3"], artist_id: undefined },
        error: null,
      });
    });

    it("allows filtering by account_id if member of org", async () => {
      vi.mocked(canAccessAccount).mockResolvedValue(true);

      const result = await buildGetChatsParams({
        account_id: "account-123",
        org_id: "org-123",
        target_account_id: "member-account",
      });

      expect(result).toEqual({
        params: { account_ids: ["member-account"], artist_id: undefined },
        error: null,
      });
      expect(canAccessAccount).toHaveBeenCalledWith({
        orgId: "org-123",
        targetAccountId: "member-account",
      });
    });

    it("returns error when account_id is not member of org", async () => {
      vi.mocked(canAccessAccount).mockResolvedValue(false);

      const result = await buildGetChatsParams({
        account_id: "account-123",
        org_id: "org-123",
        target_account_id: "non-member-account",
      });

      expect(result).toEqual({
        params: null,
        error: "account_id is not a member of this organization",
      });
    });

    it("includes artist_id filter for org key", async () => {
      vi.mocked(getAccountOrganizations).mockResolvedValue([
        { account_id: "member-1", organization_id: "org-123", organization: null },
      ]);

      const result = await buildGetChatsParams({
        account_id: "account-123",
        org_id: "org-123",
        artist_id: "artist-456",
      });

      expect(result).toEqual({
        params: { account_ids: ["member-1"], artist_id: "artist-456" },
        error: null,
      });
    });

    it("returns empty account_ids when org has no members", async () => {
      vi.mocked(getAccountOrganizations).mockResolvedValue([]);

      const result = await buildGetChatsParams({
        account_id: "org-123",
        org_id: "org-123",
      });

      expect(result).toEqual({
        params: { account_ids: [], artist_id: undefined },
        error: null,
      });
    });
  });

  describe("Recoup admin key", () => {
    const recoupOrgId = "recoup-org-id";

    it("returns empty params (no filter) to get all records", async () => {
      const result = await buildGetChatsParams({
        account_id: "admin-account",
        org_id: recoupOrgId,
      });

      expect(result).toEqual({
        params: { artist_id: undefined },
        error: null,
      });
      // Should NOT call getAccountOrganizations for admin
      expect(getAccountOrganizations).not.toHaveBeenCalled();
    });

    it("allows filtering by any account_id", async () => {
      vi.mocked(canAccessAccount).mockResolvedValue(true);

      const result = await buildGetChatsParams({
        account_id: "admin-account",
        org_id: recoupOrgId,
        target_account_id: "any-account",
      });

      expect(result).toEqual({
        params: { account_ids: ["any-account"], artist_id: undefined },
        error: null,
      });
    });

    it("includes artist_id filter for admin key", async () => {
      const result = await buildGetChatsParams({
        account_id: "admin-account",
        org_id: recoupOrgId,
        artist_id: "artist-456",
      });

      expect(result).toEqual({
        params: { artist_id: "artist-456" },
        error: null,
      });
    });
  });
});
