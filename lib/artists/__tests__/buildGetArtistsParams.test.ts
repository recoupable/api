import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGetArtistsParams } from "../buildGetArtistsParams";

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

describe("buildGetArtistsParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth accountId for personal key", async () => {
    const result = await buildGetArtistsParams({
      accountId: "personal-account-123",
      orgId: null,
    });

    expect(result).toEqual({
      params: { accountId: "personal-account-123", orgId: null },
      error: null,
    });
  });

  it("returns auth accountId for org key", async () => {
    const result = await buildGetArtistsParams({
      accountId: "org-owner-123",
      orgId: "org-123",
    });

    expect(result).toEqual({
      params: { accountId: "org-owner-123", orgId: null },
      error: null,
    });
  });

  it("defaults orgId to null when orgIdFilter is omitted", async () => {
    const result = await buildGetArtistsParams({
      accountId: "account-123",
      orgId: null,
    });

    expect(result.params?.orgId).toBeNull();
  });

  it("passes orgIdFilter through when provided", async () => {
    const result = await buildGetArtistsParams({
      accountId: "account-123",
      orgId: null,
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
      orgId: "org-123",
      targetAccountId: "target-456",
    });

    expect(canAccessAccount).toHaveBeenCalledWith({
      orgId: "org-123",
      targetAccountId: "target-456",
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
      orgId: "org-123",
      targetAccountId: "target-456",
      orgIdFilter: "filter-org-789",
    });

    expect(result).toEqual({
      params: { accountId: "target-456", orgId: "filter-org-789" },
      error: null,
    });
  });

  it("returns error when personal key tries to filter by targetAccountId", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetArtistsParams({
      accountId: "personal-123",
      orgId: null,
      targetAccountId: "other-account",
    });

    expect(result).toEqual({
      params: null,
      error: "Personal API keys cannot filter by account_id",
    });
  });

  it("returns error when org key lacks access to targetAccountId", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetArtistsParams({
      accountId: "org-owner-123",
      orgId: "org-123",
      targetAccountId: "not-in-org",
    });

    expect(result).toEqual({
      params: null,
      error: "account_id is not a member of this organization",
    });
  });
});
