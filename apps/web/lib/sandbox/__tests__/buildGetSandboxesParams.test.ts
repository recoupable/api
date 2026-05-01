import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGetSandboxesParams } from "../buildGetSandboxesParams";

import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: vi.fn(),
}));

describe("buildGetSandboxesParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns accountIds with key owner when no target_account_id", async () => {
    const result = await buildGetSandboxesParams({
      account_id: "account-123",
    });

    expect(result).toEqual({
      params: { accountIds: ["account-123"], sandboxId: undefined },
      error: null,
    });
  });

  it("returns error when personal key tries to filter by account_id", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetSandboxesParams({
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

    const result = await buildGetSandboxesParams({
      account_id: "personal-123",
      target_account_id: "shared-org-member",
    });

    expect(canAccessAccount).toHaveBeenCalledWith({
      targetAccountId: "shared-org-member",
      currentAccountId: "personal-123",
    });
    expect(result).toEqual({
      params: { accountIds: ["shared-org-member"], sandboxId: undefined },
      error: null,
    });
  });

  it("includes sandbox_id filter", async () => {
    const result = await buildGetSandboxesParams({
      account_id: "account-123",
      sandbox_id: "sbx_abc123",
    });

    expect(result).toEqual({
      params: { accountIds: ["account-123"], sandboxId: "sbx_abc123" },
      error: null,
    });
  });

  it("allows filtering by account_id when access is granted", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetSandboxesParams({
      account_id: "account-123",
      target_account_id: "member-account",
    });

    expect(result).toEqual({
      params: { accountIds: ["member-account"], sandboxId: undefined },
      error: null,
    });
    expect(canAccessAccount).toHaveBeenCalledWith({
      targetAccountId: "member-account",
      currentAccountId: "account-123",
    });
  });

  it("returns error when account_id filter is denied", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);

    const result = await buildGetSandboxesParams({
      account_id: "account-123",
      target_account_id: "non-member-account",
    });

    expect(result).toEqual({
      params: null,
      error: "Access denied to specified account_id",
    });
  });

  it("includes both target_account_id and sandbox_id when access granted", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);

    const result = await buildGetSandboxesParams({
      account_id: "account-123",
      target_account_id: "member-account",
      sandbox_id: "sbx_abc123",
    });

    expect(result).toEqual({
      params: { accountIds: ["member-account"], sandboxId: "sbx_abc123" },
      error: null,
    });
  });
});
