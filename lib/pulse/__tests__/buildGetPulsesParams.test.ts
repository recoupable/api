import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGetPulsesParams } from "../buildGetPulsesParams";

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

vi.mock("@/lib/const", () => ({
  RECOUP_ORG_ID: "recoup-org-id",
}));

import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

describe("buildGetPulsesParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns accountIds for personal key", async () => {
    const result = await buildGetPulsesParams({
      accountId: "personal-account-123",
      orgId: null,
    });

    expect(result).toEqual({
      params: { accountIds: ["personal-account-123"], active: undefined },
      error: null,
    });
  });

  it("returns orgId for org key", async () => {
    const result = await buildGetPulsesParams({
      accountId: "org-123",
      orgId: "org-123",
    });

    expect(result).toEqual({
      params: { orgId: "org-123", active: undefined },
      error: null,
    });
  });

  it("returns empty params for Recoup admin key", async () => {
    const result = await buildGetPulsesParams({
      accountId: "recoup-org-id",
      orgId: "recoup-org-id",
    });

    expect(result).toEqual({
      params: { active: undefined },
      error: null,
    });
  });

  it("includes active filter when provided", async () => {
    const result = await buildGetPulsesParams({
      accountId: "account-123",
      orgId: null,
      active: true,
    });

    expect(result).toEqual({
      params: { accountIds: ["account-123"], active: true },
      error: null,
    });
  });

  it("returns targetAccountId when access is granted", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetPulsesParams({
      accountId: "org-123",
      orgId: "org-123",
      targetAccountId: "target-456",
    });

    expect(canAccessAccount).toHaveBeenCalledWith({
      orgId: "org-123",
      targetAccountId: "target-456",
    });
    expect(result).toEqual({
      params: { accountIds: ["target-456"], active: undefined },
      error: null,
    });
  });

  it("returns error when personal key tries to filter by targetAccountId", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetPulsesParams({
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

    const result = await buildGetPulsesParams({
      accountId: "org-123",
      orgId: "org-123",
      targetAccountId: "not-in-org",
    });

    expect(result).toEqual({
      params: null,
      error: "account_id is not a member of this organization",
    });
  });
});
