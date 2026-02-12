import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGetArtistsParams } from "../buildGetArtistsParams";

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-org-id",
}));

import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

describe("buildGetArtistsParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns personal artists for personal key with no filter", async () => {
    const result = await buildGetArtistsParams({
      accountId: "personal-123",
      orgId: null,
    });

    expect(result).toEqual({
      params: { accountId: "personal-123", orgId: null },
      error: null,
    });
  });

  it("returns personal artists for org key with no filter", async () => {
    const result = await buildGetArtistsParams({
      accountId: "org-account",
      orgId: "org-123",
    });

    expect(result).toEqual({
      params: { accountId: "org-account", orgId: null },
      error: null,
    });
  });

  it("returns personal artists for Recoup admin with no filter", async () => {
    const result = await buildGetArtistsParams({
      accountId: "recoup-admin",
      orgId: "recoup-org-id",
    });

    expect(result).toEqual({
      params: { accountId: "recoup-admin", orgId: null },
      error: null,
    });
  });

  it("returns target account when access is granted", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetArtistsParams({
      accountId: "org-account",
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

  it("returns error when personal key tries to filter by account_id", async () => {
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

  it("returns error when org key lacks access to target account", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetArtistsParams({
      accountId: "org-account",
      orgId: "org-123",
      targetAccountId: "not-in-org",
    });

    expect(result).toEqual({
      params: null,
      error: "account_id is not a member of this organization",
    });
  });

  it("returns target account for Recoup admin with filter", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetArtistsParams({
      accountId: "recoup-admin",
      orgId: "recoup-org-id",
      targetAccountId: "any-account",
    });

    expect(canAccessAccount).toHaveBeenCalledWith({
      orgId: "recoup-org-id",
      targetAccountId: "any-account",
    });
    expect(result).toEqual({
      params: { accountId: "any-account", orgId: null },
      error: null,
    });
  });

  it("passes organizationId as orgId when provided", async () => {
    const result = await buildGetArtistsParams({
      accountId: "org-account",
      orgId: "org-123",
      organizationId: "org-uuid",
    });

    expect(result).toEqual({
      params: { accountId: "org-account", orgId: "org-uuid" },
      error: null,
    });
  });
});
