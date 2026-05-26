import { describe, it, expect, beforeEach, vi } from "vitest";
import { ensurePersonalRepo } from "@/lib/recoupable/ensurePersonalRepo";
import { repositoryExists } from "@/lib/github/repositoryExists";
import { createRepository } from "@/lib/github/createRepository";
import { findLegacyAccountRepo } from "@/lib/github/findLegacyAccountRepo";
import { renameRepository } from "@/lib/github/renameRepository";
import { getServiceGithubToken } from "@/lib/github/getServiceGithubToken";

vi.mock("@/lib/github/getServiceGithubToken", () => ({
  getServiceGithubToken: vi.fn(),
}));
vi.mock("@/lib/github/repositoryExists", () => ({
  repositoryExists: vi.fn(),
}));
vi.mock("@/lib/github/createRepository", () => ({
  createRepository: vi.fn(),
}));
vi.mock("@/lib/github/findLegacyAccountRepo", () => ({
  findLegacyAccountRepo: vi.fn(),
}));
vi.mock("@/lib/github/renameRepository", () => ({
  renameRepository: vi.fn(),
}));

const accountId = "fb678396-a68f-4294-ae50-b8cacf9ce77b";

describe("ensurePersonalRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when GITHUB_TOKEN is missing", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue(undefined);

    const result = await ensurePersonalRepo({ accountId });

    expect(result).toBeNull();
    expect(repositoryExists).not.toHaveBeenCalled();
  });

  it("returns the existing repo URL when recoupable/<accountId> already exists", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
    vi.mocked(repositoryExists).mockResolvedValue(true);

    const result = await ensurePersonalRepo({ accountId });

    expect(result).toEqual({
      cloneUrl: `https://github.com/recoupable/${accountId}`,
      repoUrl: `https://github.com/recoupable/${accountId}`,
      owner: "recoupable",
      repoName: accountId,
    });
    expect(findLegacyAccountRepo).not.toHaveBeenCalled();
    expect(renameRepository).not.toHaveBeenCalled();
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("returns null when the existence check fails for non-404 reasons", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
    vi.mocked(repositoryExists).mockResolvedValue(null);

    expect(await ensurePersonalRepo({ accountId })).toBeNull();
    expect(findLegacyAccountRepo).not.toHaveBeenCalled();
  });

  it("renames a legacy <slug>-<accountId> repo when present (history preserved)", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
    vi.mocked(repositoryExists).mockResolvedValue(false);
    vi.mocked(findLegacyAccountRepo).mockResolvedValue(`sweetman-${accountId}`);
    vi.mocked(renameRepository).mockResolvedValue({
      success: true,
      cloneUrl: `https://github.com/recoupable/${accountId}.git`,
      repoUrl: `https://github.com/recoupable/${accountId}`,
    });

    const result = await ensurePersonalRepo({ accountId });

    expect(renameRepository).toHaveBeenCalledWith({
      owner: "recoupable",
      repo: `sweetman-${accountId}`,
      newName: accountId,
      token: "tok",
    });
    expect(result).toEqual({
      cloneUrl: `https://github.com/recoupable/${accountId}`,
      repoUrl: `https://github.com/recoupable/${accountId}`,
      owner: "recoupable",
      repoName: accountId,
    });
    expect(createRepository).not.toHaveBeenCalled();
  });

  it("falls through to create when the legacy rename fails", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
    vi.mocked(repositoryExists).mockResolvedValue(false);
    vi.mocked(findLegacyAccountRepo).mockResolvedValue(`sweetman-${accountId}`);
    vi.mocked(renameRepository).mockResolvedValue({
      success: false,
      error: "boom",
    });
    vi.mocked(createRepository).mockResolvedValue({
      success: true,
      cloneUrl: `https://github.com/recoupable/${accountId}.git`,
      repoUrl: `https://github.com/recoupable/${accountId}`,
      owner: "recoupable",
      repoName: accountId,
    });

    const result = await ensurePersonalRepo({ accountId });

    expect(createRepository).toHaveBeenCalled();
    expect(result?.repoName).toBe(accountId);
  });

  it("creates a fresh repo when no legacy match exists", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
    vi.mocked(repositoryExists).mockResolvedValue(false);
    vi.mocked(findLegacyAccountRepo).mockResolvedValue(null);
    vi.mocked(createRepository).mockResolvedValue({
      success: true,
      cloneUrl: `https://github.com/recoupable/${accountId}.git`,
      repoUrl: `https://github.com/recoupable/${accountId}`,
      owner: "recoupable",
      repoName: accountId,
    });

    const result = await ensurePersonalRepo({ accountId });

    expect(createRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "recoupable",
        name: accountId,
        isPrivate: true,
        token: "tok",
      }),
    );
    expect(renameRepository).not.toHaveBeenCalled();
    expect(result?.repoName).toBe(accountId);
  });

  it("creates a fresh repo when legacy search itself errors (undefined)", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
    vi.mocked(repositoryExists).mockResolvedValue(false);
    vi.mocked(findLegacyAccountRepo).mockResolvedValue(undefined);
    vi.mocked(createRepository).mockResolvedValue({
      success: true,
      cloneUrl: `https://github.com/recoupable/${accountId}.git`,
      repoUrl: `https://github.com/recoupable/${accountId}`,
      owner: "recoupable",
      repoName: accountId,
    });

    const result = await ensurePersonalRepo({ accountId });

    expect(renameRepository).not.toHaveBeenCalled();
    expect(createRepository).toHaveBeenCalled();
    expect(result?.repoName).toBe(accountId);
  });

  it("returns null when creation outright fails", async () => {
    vi.mocked(getServiceGithubToken).mockReturnValue("tok");
    vi.mocked(repositoryExists).mockResolvedValue(false);
    vi.mocked(findLegacyAccountRepo).mockResolvedValue(null);
    vi.mocked(createRepository).mockResolvedValue({
      success: false,
      error: "Permission denied",
    });

    expect(await ensurePersonalRepo({ accountId })).toBeNull();
  });
});
