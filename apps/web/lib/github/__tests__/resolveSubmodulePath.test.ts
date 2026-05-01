import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveSubmodulePath } from "../resolveSubmodulePath";
import { getRepoGitModules } from "../getRepoGitModules";

vi.mock("../getRepoGitModules", () => ({
  getRepoGitModules: vi.fn(),
}));

describe("resolveSubmodulePath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns submodule repo and relative path for submodule files", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue([
      {
        path: ".openclaw/workspace/orgs/my-org",
        url: "https://github.com/recoupable/org-my-org-abc123",
      },
    ]);

    const result = await resolveSubmodulePath({
      githubRepo: "https://github.com/user/repo",
      path: ".openclaw/workspace/orgs/my-org/artist.md",
    });

    expect(result).toEqual({
      githubRepo: "https://github.com/recoupable/org-my-org-abc123",
      path: "artist.md",
    });
  });

  it("returns original values for non-submodule paths", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue([
      {
        path: ".openclaw/workspace/orgs/my-org",
        url: "https://github.com/recoupable/org-my-org-abc123",
      },
    ]);

    const result = await resolveSubmodulePath({
      githubRepo: "https://github.com/user/repo",
      path: "README.md",
    });

    expect(result).toEqual({
      githubRepo: "https://github.com/user/repo",
      path: "README.md",
    });
  });

  it("returns original values when getRepoGitModules returns null", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue(null);

    const result = await resolveSubmodulePath({
      githubRepo: "https://github.com/user/repo",
      path: ".openclaw/workspace/orgs/my-org/artist.md",
    });

    expect(result).toEqual({
      githubRepo: "https://github.com/user/repo",
      path: ".openclaw/workspace/orgs/my-org/artist.md",
    });
  });

  it("returns original values for invalid GitHub URL", async () => {
    const result = await resolveSubmodulePath({
      githubRepo: "not-a-valid-url",
      path: "some/file.ts",
    });

    expect(result).toEqual({
      githubRepo: "not-a-valid-url",
      path: "some/file.ts",
    });
    expect(getRepoGitModules).not.toHaveBeenCalled();
  });

  it("handles nested paths within submodule", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue([
      {
        path: ".openclaw/workspace/orgs/my-org",
        url: "https://github.com/recoupable/org-abc",
      },
    ]);

    const result = await resolveSubmodulePath({
      githubRepo: "https://github.com/user/repo",
      path: ".openclaw/workspace/orgs/my-org/data/deep/file.json",
    });

    expect(result).toEqual({
      githubRepo: "https://github.com/recoupable/org-abc",
      path: "data/deep/file.json",
    });
  });

  it("matches the longest submodule path when paths overlap", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue([
      { path: "orgs", url: "https://github.com/recoupable/orgs-parent" },
      { path: "orgs/specific", url: "https://github.com/recoupable/orgs-specific" },
    ]);

    const result = await resolveSubmodulePath({
      githubRepo: "https://github.com/user/repo",
      path: "orgs/specific/file.md",
    });

    expect(result).toEqual({
      githubRepo: "https://github.com/recoupable/orgs-specific",
      path: "file.md",
    });
  });

  it("does not match path that only shares a prefix but not a directory boundary", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue([
      { path: "orgs/my-org", url: "https://github.com/recoupable/org-abc" },
    ]);

    const result = await resolveSubmodulePath({
      githubRepo: "https://github.com/user/repo",
      path: "orgs/my-org-extra/file.md",
    });

    expect(result).toEqual({
      githubRepo: "https://github.com/user/repo",
      path: "orgs/my-org-extra/file.md",
    });
  });

  it("passes correct params to getRepoGitModules", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue([]);

    await resolveSubmodulePath({
      githubRepo: "https://github.com/my-owner/my-repo",
      path: "some/file.ts",
    });

    expect(getRepoGitModules).toHaveBeenCalledWith({
      owner: "my-owner",
      repo: "my-repo",
      branch: "main",
    });
  });
});
