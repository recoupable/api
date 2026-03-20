import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGetOrganizationsParams } from "../buildGetOrganizationsParams";

import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

describe("buildGetOrganizationsParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns accountId for authenticated account", async () => {
    const result = await buildGetOrganizationsParams({
      accountId: "personal-account-123",
    });

    expect(result).toEqual({
      params: { accountId: "personal-account-123" },
      error: null,
    });
  });

  it("returns targetAccountId when access is granted", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetOrganizationsParams({
      accountId: "org-123",
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

  it("allows account to access targetAccountId via shared org", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetOrganizationsParams({
      accountId: "personal-123",
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

  it("returns error when account lacks access to targetAccountId", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetOrganizationsParams({
      accountId: "personal-123",
      targetAccountId: "other-account",
    });

    expect(result).toEqual({
      params: null,
      error: "Access denied to specified account_id",
    });
  });

  it("returns error when access to targetAccountId is denied", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetOrganizationsParams({
      accountId: "org-123",
      targetAccountId: "not-in-org",
    });

    expect(result).toEqual({
      params: null,
      error: "Access denied to specified account_id",
    });
  });
});
