import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGetArtistsParams } from "../buildGetArtistsParams";

import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

describe("buildGetArtistsParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth accountId for authenticated account", async () => {
    const result = await buildGetArtistsParams({
      accountId: "personal-account-123",
    });

    expect(result).toEqual({
      params: { accountId: "personal-account-123", orgId: null },
      error: null,
    });
  });

  it("returns auth accountId for account with org membership", async () => {
    const result = await buildGetArtistsParams({
      accountId: "org-owner-123",
    });

    expect(result).toEqual({
      params: { accountId: "org-owner-123", orgId: null },
      error: null,
    });
  });

  it("defaults orgId to null when orgIdFilter is omitted", async () => {
    const result = await buildGetArtistsParams({
      accountId: "account-123",
    });

    expect(result.params?.orgId).toBeNull();
  });

  it("passes orgIdFilter through when provided", async () => {
    const result = await buildGetArtistsParams({
      accountId: "account-123",
      orgIdFilter: "filter-org-456",
    });

    expect(result).toEqual({
      params: { accountId: "account-123", orgId: "filter-org-456" },
      error: null,
    });
  });

  it("returns targetAccountId when access is granted", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetArtistsParams({
      accountId: "org-owner-123",
      targetAccountId: "target-456",
    });

    expect(canAccessAccount).toHaveBeenCalledWith({
      targetAccountId: "target-456",
      currentAccountId: "org-owner-123",
    });
    expect(result).toEqual({
      params: { accountId: "target-456", orgId: null },
      error: null,
    });
  });

  it("returns targetAccountId with orgIdFilter when both provided", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetArtistsParams({
      accountId: "org-owner-123",
      targetAccountId: "target-456",
      orgIdFilter: "filter-org-789",
    });

    expect(result).toEqual({
      params: { accountId: "target-456", orgId: "filter-org-789" },
      error: null,
    });
  });

  it("allows account to access targetAccountId via shared org", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetArtistsParams({
      accountId: "personal-123",
      targetAccountId: "shared-org-member",
    });

    expect(canAccessAccount).toHaveBeenCalledWith({
      targetAccountId: "shared-org-member",
      currentAccountId: "personal-123",
    });
    expect(result).toEqual({
      params: { accountId: "shared-org-member", orgId: null },
      error: null,
    });
  });

  it("returns error when account has no shared org with targetAccountId", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetArtistsParams({
      accountId: "personal-123",
      targetAccountId: "other-account",
    });

    expect(result).toEqual({
      params: null,
      error: "Access denied to specified account_id",
    });
  });

  it("returns error when account lacks access to targetAccountId", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetArtistsParams({
      accountId: "org-owner-123",
      targetAccountId: "not-in-org",
    });

    expect(result).toEqual({
      params: null,
      error: "Access denied to specified account_id",
    });
  });
});
