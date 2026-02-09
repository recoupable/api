import { describe, it, expect, vi, beforeEach } from "vitest";

import { deleteGithubRepo } from "../deleteGithubRepo";
import { parseGitHubRepoUrl } from "../parseGitHubRepoUrl";

vi.mock("@/lib/github/parseGitHubRepoUrl", () => ({
  parseGitHubRepoUrl: vi.fn(),
}));

describe("deleteGithubRepo", () => {
  const mockRepoUrl = "https://github.com/recoupable/test-repo";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    global.fetch = vi.fn();
  });

  it("returns true when repo is deleted successfully", async () => {
    vi.mocked(parseGitHubRepoUrl).mockReturnValue({
      owner: "recoupable",
      repo: "test-repo",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 204,
    } as Response);

    const result = await deleteGithubRepo(mockRepoUrl);

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/test-repo",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("returns false when GITHUB_TOKEN is not set", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");

    const result = await deleteGithubRepo(mockRepoUrl);

    expect(result).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns false when URL cannot be parsed", async () => {
    vi.mocked(parseGitHubRepoUrl).mockReturnValue(null);

    const result = await deleteGithubRepo("not-a-valid-url");

    expect(result).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns false when GitHub API returns an error", async () => {
    vi.mocked(parseGitHubRepoUrl).mockReturnValue({
      owner: "recoupable",
      repo: "test-repo",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const result = await deleteGithubRepo(mockRepoUrl);

    expect(result).toBe(false);
  });

  it("returns false when fetch throws an error", async () => {
    vi.mocked(parseGitHubRepoUrl).mockReturnValue({
      owner: "recoupable",
      repo: "test-repo",
    });
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    const result = await deleteGithubRepo(mockRepoUrl);

    expect(result).toBe(false);
  });
});
