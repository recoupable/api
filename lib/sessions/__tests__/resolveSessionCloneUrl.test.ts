import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveSessionCloneUrl } from "@/lib/sessions/resolveSessionCloneUrl";
import { ensurePersonalRepo } from "@/lib/recoupable/ensurePersonalRepo";
import type { AuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/recoupable/ensurePersonalRepo", () => ({
  ensurePersonalRepo: vi.fn(),
}));

const accountId = "fb678396-a68f-4294-ae50-b8cacf9ce77b";
const orgId = "0a0a0a0a-a0a0-4a0a-8a0a-aaaaaaaaaaaa";
const baseAuth: AuthContext = {
  accountId,
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
      auth: { ...baseAuth, orgId },
    });

    expect(result).toEqual({
      ok: true,
      cloneUrl: "https://github.com/recoupable/org-foo-id-1",
    });
    expect(ensurePersonalRepo).not.toHaveBeenCalled();
  });

  it("provisions the user's workspace when no body cloneUrl and no org", async () => {
    vi.mocked(ensurePersonalRepo).mockResolvedValue(`https://github.com/recoupable/${accountId}`);

    const result = await resolveSessionCloneUrl({
      bodyCloneUrl: undefined,
      auth: baseAuth,
    });

    expect(result).toEqual({
      ok: true,
      cloneUrl: `https://github.com/recoupable/${accountId}`,
    });
    expect(ensurePersonalRepo).toHaveBeenCalledWith({ accountId });
  });

  it("provisions the ORG's workspace when no body cloneUrl and an org is bound", async () => {
    vi.mocked(ensurePersonalRepo).mockResolvedValue(`https://github.com/recoupable/${orgId}`);

    const result = await resolveSessionCloneUrl({
      bodyCloneUrl: undefined,
      auth: { ...baseAuth, orgId },
    });

    expect(result).toEqual({
      ok: true,
      cloneUrl: `https://github.com/recoupable/${orgId}`,
    });
    // Keyed on orgId (organizations are accounts), not the caller's accountId.
    expect(ensurePersonalRepo).toHaveBeenCalledWith({ accountId: orgId });
  });

  it("returns an error when ensurePersonalRepo fails", async () => {
    vi.mocked(ensurePersonalRepo).mockResolvedValue(null);

    const result = await resolveSessionCloneUrl({
      bodyCloneUrl: undefined,
      auth: baseAuth,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});
