import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGetChatsParams } from "../buildGetChatsParams";

import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
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
    it("returns org_id when no target_account_id", async () => {
      const org_id = "org-123";
      const result = await buildGetChatsParams({
        account_id: "account-123",
        org_id,
      });

      expect(result).toEqual({
        params: { org_id, artist_id: undefined },
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
      const result = await buildGetChatsParams({
        account_id: "account-123",
        org_id: "org-123",
        artist_id: "artist-456",
      });

      expect(result).toEqual({
        params: { org_id: "org-123", artist_id: "artist-456" },
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
