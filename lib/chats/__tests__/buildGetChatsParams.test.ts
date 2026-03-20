import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGetChatsParams } from "../buildGetChatsParams";

import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

describe("buildGetChatsParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns account_ids with key owner when no target_account_id", async () => {
    const result = await buildGetChatsParams({
      account_id: "account-123",
    });

    expect(result).toEqual({
      params: { account_ids: ["account-123"], artist_id: undefined },
      error: null,
    });
  });

  it("returns error when account lacks access to filter by account_id", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetChatsParams({
      account_id: "account-123",
      target_account_id: "other-account",
    });

    expect(result).toEqual({
      params: null,
      error: "Access denied to specified account_id",
    });
  });

  it("allows access to target_account_id via shared org", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetChatsParams({
      account_id: "personal-123",
      target_account_id: "shared-org-member",
    });

    expect(canAccessAccount).toHaveBeenCalledWith({
      targetAccountId: "shared-org-member",
      currentAccountId: "personal-123",
    });
    expect(result).toEqual({
      params: { account_ids: ["shared-org-member"], artist_id: undefined },
      error: null,
    });
  });

  it("includes artist_id filter", async () => {
    const result = await buildGetChatsParams({
      account_id: "account-123",
      artist_id: "artist-456",
    });

    expect(result).toEqual({
      params: { account_ids: ["account-123"], artist_id: "artist-456" },
      error: null,
    });
  });

  it("allows filtering by account_id when access is granted", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetChatsParams({
      account_id: "account-123",
      target_account_id: "member-account",
    });

    expect(result).toEqual({
      params: { account_ids: ["member-account"], artist_id: undefined },
      error: null,
    });
    expect(canAccessAccount).toHaveBeenCalledWith({
      targetAccountId: "member-account",
      currentAccountId: "account-123",
    });
  });

  it("returns error when account_id filter is denied", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetChatsParams({
      account_id: "account-123",
      target_account_id: "non-member-account",
    });

    expect(result).toEqual({
      params: null,
      error: "Access denied to specified account_id",
    });
  });

  it("includes artist_id with target_account_id", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetChatsParams({
      account_id: "account-123",
      target_account_id: "member-account",
      artist_id: "artist-456",
    });

    expect(result).toEqual({
      params: { account_ids: ["member-account"], artist_id: "artist-456" },
      error: null,
    });
  });
});
