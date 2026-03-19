import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGetOrganizationsParams } from "../buildGetOrganizationsParams";

import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-org-id",
}));

describe("buildGetOrganizationsParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns accountId for personal key", async () => {
    const result = await buildGetOrganizationsParams({
      accountId: "personal-account-123",
      orgId: null,
    });

    expect(result).toEqual({
      params: { accountId: "personal-account-123" },
      error: null,
    });
  });

  it("returns organizationId for org key", async () => {
    const result = await buildGetOrganizationsParams({
      accountId: "org-123",
      orgId: "org-123",
    });

    expect(result).toEqual({
      params: { organizationId: "org-123" },
      error: null,
    });
  });

  it("returns empty params for Recoup admin key", async () => {
    const result = await buildGetOrganizationsParams({
      accountId: "recoup-org-id",
      orgId: "recoup-org-id",
    });

    expect(result).toEqual({
      params: {},
      error: null,
    });
  });

  it("returns targetAccountId when access is granted", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetOrganizationsParams({
      accountId: "org-123",
      orgId: "org-123",
      targetAccountId: "target-456",
    });

    expect(canAccessAccount).toHaveBeenCalledWith({
      targetAccountId: "target-456",
      currentAccountId: "org-123",
    });
    expect(result).toEqual({
      params: { accountId: "target-456" },
      error: null,
    });
  });

  it("allows personal key to access targetAccountId via shared org", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetOrganizationsParams({
      accountId: "personal-123",
      orgId: null,
      targetAccountId: "shared-org-member",
    });

    expect(canAccessAccount).toHaveBeenCalledWith({
      targetAccountId: "shared-org-member",
      currentAccountId: "personal-123",
    });
    expect(result).toEqual({
      params: { accountId: "shared-org-member" },
      error: null,
    });
  });

  it("returns error when personal key tries to filter by targetAccountId", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetOrganizationsParams({
      accountId: "personal-123",
      orgId: null,
      targetAccountId: "other-account",
    });

    expect(result).toEqual({
      params: null,
      error: "Access denied to specified account_id",
    });
  });

  it("returns error when org key lacks access to targetAccountId", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetOrganizationsParams({
      accountId: "org-123",
      orgId: "org-123",
      targetAccountId: "not-in-org",
    });

    expect(result).toEqual({
      params: null,
      error: "Access denied to specified account_id",
    });
  });

  it("returns targetAccountId for Recoup admin with filter", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetOrganizationsParams({
      accountId: "recoup-org-id",
      orgId: "recoup-org-id",
      targetAccountId: "any-account",
    });

    expect(canAccessAccount).toHaveBeenCalledWith({
      targetAccountId: "any-account",
      currentAccountId: "recoup-org-id",
    });
    expect(result).toEqual({
      params: { accountId: "any-account" },
      error: null,
    });
  });
});
