import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/github/deleteGithubRepo", () => ({
  deleteGithubRepo: vi.fn(),
}));

vi.mock("@/lib/github/findOrgReposByAccountId", () => ({
  findOrgReposByAccountId: vi.fn(),
}));

import { deleteAccountGithubRepos } from "../deleteAccountGithubRepos";
import { deleteGithubRepo } from "../deleteGithubRepo";
import { findOrgReposByAccountId } from "../findOrgReposByAccountId";

describe("deleteAccountGithubRepos", () => {
  const mockAccountId = "550e8400-e29b-41d4-a716-446655440000";
  const mockRepoUrl = "https://github.com/recoupable/test-repo";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when no repos to delete", async () => {
    vi.mocked(findOrgReposByAccountId).mockResolvedValue([]);

    const result = await deleteAccountGithubRepos(mockAccountId, null);

    expect(result).toBe(true);
    expect(deleteGithubRepo).not.toHaveBeenCalled();
  });

  it("deletes repo from snapshot github_repo", async () => {
    vi.mocked(findOrgReposByAccountId).mockResolvedValue([]);
    vi.mocked(deleteGithubRepo).mockResolvedValue(true);

    const result = await deleteAccountGithubRepos(mockAccountId, mockRepoUrl);

    expect(result).toBe(true);
    expect(deleteGithubRepo).toHaveBeenCalledWith(mockRepoUrl);
  });

  it("deletes repos found by org search", async () => {
    const orgRepoUrl = "https://github.com/recoupable/artist-550e8400-e29b-41d4-a716-446655440000";
    vi.mocked(findOrgReposByAccountId).mockResolvedValue([orgRepoUrl]);
    vi.mocked(deleteGithubRepo).mockResolvedValue(true);

    const result = await deleteAccountGithubRepos(mockAccountId, null);

    expect(result).toBe(true);
    expect(deleteGithubRepo).toHaveBeenCalledWith(orgRepoUrl);
  });

  it("deduplicates repos from snapshot and org search", async () => {
    vi.mocked(findOrgReposByAccountId).mockResolvedValue([mockRepoUrl]);
    vi.mocked(deleteGithubRepo).mockResolvedValue(true);

    const result = await deleteAccountGithubRepos(mockAccountId, mockRepoUrl);

    expect(result).toBe(true);
    expect(deleteGithubRepo).toHaveBeenCalledTimes(1);
  });

  it("returns false when any repo deletion fails", async () => {
    vi.mocked(findOrgReposByAccountId).mockResolvedValue([]);
    vi.mocked(deleteGithubRepo).mockResolvedValue(false);

    const result = await deleteAccountGithubRepos(mockAccountId, mockRepoUrl);

    expect(result).toBe(false);
  });
});
