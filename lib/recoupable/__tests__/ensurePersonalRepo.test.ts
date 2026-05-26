import { describe, it, expect, beforeEach, vi } from "vitest";
import { ensurePersonalRepo } from "@/lib/recoupable/ensurePersonalRepo";
import { repositoryExists } from "@/lib/github/repositoryExists";
import { createRepository } from "@/lib/github/createRepository";

vi.mock("@/lib/github/repositoryExists", () => ({
  repositoryExists: vi.fn(),
}));
vi.mock("@/lib/github/createRepository", () => ({
  createRepository: vi.fn(),
}));

const accountId = "fb678396-a68f-4294-ae50-b8cacf9ce77b";

describe("ensurePersonalRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing repo URL when recoupable/<accountId> already exists", async () => {
    vi.mocked(repositoryExists).mockResolvedValue(true);

    const result = await ensurePersonalRepo({ accountId });

    expect(result).toEqual({
      cloneUrl: `https://github.com/recoupable/${accountId}`,
      repoUrl: `https://github.com/recoupable/${accountId}`,
      owner: "recoupable",
      repoName: accountId,
    });
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("returns null when the existence check fails for non-404 reasons", async () => {
    vi.mocked(repositoryExists).mockResolvedValue(null);

    expect(await ensurePersonalRepo({ accountId })).toBeNull();
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("creates a fresh repo when none exists", async () => {
    vi.mocked(repositoryExists).mockResolvedValue(false);
    vi.mocked(createRepository).mockResolvedValue({
      success: true,
      cloneUrl: `https://github.com/recoupable/${accountId}.git`,
      repoUrl: `https://github.com/recoupable/${accountId}`,
      owner: "recoupable",
      repoName: accountId,
    });

    const result = await ensurePersonalRepo({ accountId });

    expect(createRepository).toHaveBeenCalledWith({ name: accountId });
    expect(result?.repoName).toBe(accountId);
  });

  it("returns null when creation outright fails", async () => {
    vi.mocked(repositoryExists).mockResolvedValue(false);
    vi.mocked(createRepository).mockResolvedValue({
      success: false,
      error: "Permission denied",
    });

    expect(await ensurePersonalRepo({ accountId })).toBeNull();
  });
});
