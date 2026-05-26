import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveSessionCloneUrl } from "@/lib/sessions/resolveSessionCloneUrl";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { ensurePersonalRepo } from "@/lib/recoupable/ensurePersonalRepo";
import type { AuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/supabase/accounts/getAccountWithDetails", () => ({
  getAccountWithDetails: vi.fn(),
}));
vi.mock("@/lib/recoupable/ensurePersonalRepo", () => ({
  ensurePersonalRepo: vi.fn(),
}));

const baseAuth: AuthContext = {
  accountId: "acc-1",
  orgId: null,
  authToken: "tok",
};

describe("resolveSessionCloneUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the body cloneUrl when provided, regardless of org state", async () => {
    const result = await resolveSessionCloneUrl({
      bodyCloneUrl: "https://github.com/recoupable/org-foo-id-1",
      auth: { ...baseAuth, orgId: "org-1" },
    });

    expect(result).toEqual({
      ok: true,
      cloneUrl: "https://github.com/recoupable/org-foo-id-1",
    });
    expect(getAccountWithDetails).not.toHaveBeenCalled();
    expect(ensurePersonalRepo).not.toHaveBeenCalled();
  });

  it("returns cloneUrl=null when no body cloneUrl and an org is bound (current narrow scope)", async () => {
    const result = await resolveSessionCloneUrl({
      bodyCloneUrl: undefined,
      auth: { ...baseAuth, orgId: "org-1" },
    });

    expect(result).toEqual({ ok: true, cloneUrl: null });
    expect(ensurePersonalRepo).not.toHaveBeenCalled();
  });

  it("provisions a personal repo when no body cloneUrl and no org", async () => {
    vi.mocked(getAccountWithDetails).mockResolvedValue({
      name: "Sweetman",
      email: "sweetman@example.com",
    } as never);
    vi.mocked(ensurePersonalRepo).mockResolvedValue({
      cloneUrl: "https://github.com/recoupable/sweetman-acc-1",
      repoUrl: "https://github.com/recoupable/sweetman-acc-1",
      owner: "recoupable",
      repoName: "sweetman-acc-1",
    });

    const result = await resolveSessionCloneUrl({
      bodyCloneUrl: undefined,
      auth: baseAuth,
    });

    expect(result).toEqual({
      ok: true,
      cloneUrl: "https://github.com/recoupable/sweetman-acc-1",
    });
    expect(ensurePersonalRepo).toHaveBeenCalledWith({
      accountName: "Sweetman",
      accountId: "acc-1",
    });
  });

  it("falls back to email local-part when name is missing", async () => {
    vi.mocked(getAccountWithDetails).mockResolvedValue({
      name: null,
      email: "sweetmantech@gmail.com",
    } as never);
    vi.mocked(ensurePersonalRepo).mockResolvedValue({
      cloneUrl: "url",
      repoUrl: "url",
      owner: "recoupable",
      repoName: "sweetmantech-acc-1",
    });

    await resolveSessionCloneUrl({
      bodyCloneUrl: undefined,
      auth: baseAuth,
    });

    expect(ensurePersonalRepo).toHaveBeenCalledWith({
      accountName: "sweetmantech",
      accountId: "acc-1",
    });
  });

  it("returns an error when account has no name and no email", async () => {
    vi.mocked(getAccountWithDetails).mockResolvedValue({
      name: null,
      email: null,
    } as never);

    const result = await resolveSessionCloneUrl({
      bodyCloneUrl: undefined,
      auth: baseAuth,
    });

    expect(result.ok).toBe(false);
    expect(ensurePersonalRepo).not.toHaveBeenCalled();
  });

  it("returns an error when the account row is missing", async () => {
    vi.mocked(getAccountWithDetails).mockResolvedValue(null);

    const result = await resolveSessionCloneUrl({
      bodyCloneUrl: undefined,
      auth: baseAuth,
    });

    expect(result.ok).toBe(false);
    expect(ensurePersonalRepo).not.toHaveBeenCalled();
  });

  it("returns an error when ensurePersonalRepo fails", async () => {
    vi.mocked(getAccountWithDetails).mockResolvedValue({
      name: "Sweetman",
    } as never);
    vi.mocked(ensurePersonalRepo).mockResolvedValue(null);

    const result = await resolveSessionCloneUrl({
      bodyCloneUrl: undefined,
      auth: baseAuth,
    });

    expect(result.ok).toBe(false);
  });
});
