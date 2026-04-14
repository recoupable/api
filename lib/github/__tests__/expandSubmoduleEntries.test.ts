import { describe, it, expect, vi, beforeEach } from "vitest";
import { expandSubmoduleEntries } from "../expandSubmoduleEntries";
import { getRepoGitModules } from "../getRepoGitModules";
import { getRepoFileTree } from "../getRepoFileTree";

vi.mock("../getRepoGitModules", () => ({
  getRepoGitModules: vi.fn(),
}));

vi.mock("../getRepoFileTree", () => ({
  getRepoFileTree: vi.fn(),
}));

const repo = { owner: "owner", repo: "repo", branch: "main" };

describe("expandSubmoduleEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expands submodule with fetched tree contents", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue([
      { path: "orgs/my-org", url: "https://github.com/recoupable/org-abc" },
    ]);
    vi.mocked(getRepoFileTree).mockResolvedValue([
      { path: "artist.md", type: "blob", sha: "art1", size: 200 },
      { path: "data", type: "tree", sha: "data1" },
    ]);

    const result = await expandSubmoduleEntries({
      regularEntries: [{ path: "README.md", type: "blob", sha: "abc", size: 50 }],
      submoduleEntries: [{ path: "orgs/my-org", sha: "sub1" }],
      repo,
    });

    expect(result).toEqual([
      { path: "README.md", type: "blob", sha: "abc", size: 50 },
      { path: "orgs/my-org", type: "tree", sha: "sub1" },
      { path: "orgs/my-org/artist.md", type: "blob", sha: "art1", size: 200 },
      { path: "orgs/my-org/data", type: "tree", sha: "data1" },
    ]);
    expect(getRepoFileTree).toHaveBeenCalledWith("https://github.com/recoupable/org-abc");
  });

  it("converts submodules to empty directories when getRepoGitModules returns null", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue(null);

    const result = await expandSubmoduleEntries({
      regularEntries: [],
      submoduleEntries: [{ path: "orgs/my-org", sha: "sub1" }],
      repo,
    });

    expect(result).toEqual([{ path: "orgs/my-org", type: "tree", sha: "sub1" }]);
    expect(getRepoFileTree).not.toHaveBeenCalled();
  });

  it("converts submodule to empty directory when URL not found in .gitmodules", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue([
      { path: "orgs/other-org", url: "https://github.com/recoupable/other" },
    ]);

    const result = await expandSubmoduleEntries({
      regularEntries: [],
      submoduleEntries: [{ path: "orgs/unknown", sha: "sub1" }],
      repo,
    });

    expect(result).toEqual([{ path: "orgs/unknown", type: "tree", sha: "sub1" }]);
    expect(getRepoFileTree).not.toHaveBeenCalled();
  });

  it("converts submodule to empty directory when submodule tree fetch returns null", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue([
      { path: "orgs/my-org", url: "https://github.com/recoupable/org-abc" },
    ]);
    vi.mocked(getRepoFileTree).mockResolvedValue(null);

    const result = await expandSubmoduleEntries({
      regularEntries: [],
      submoduleEntries: [{ path: "orgs/my-org", sha: "sub1" }],
      repo,
    });

    expect(result).toEqual([{ path: "orgs/my-org", type: "tree", sha: "sub1" }]);
  });

  it("expands multiple submodules in parallel", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue([
      { path: "orgs/org-a", url: "https://github.com/recoupable/org-a" },
      { path: "orgs/org-b", url: "https://github.com/recoupable/org-b" },
    ]);
    vi.mocked(getRepoFileTree)
      .mockResolvedValueOnce([{ path: "a.md", type: "blob", sha: "a1", size: 10 }])
      .mockResolvedValueOnce([{ path: "b.md", type: "blob", sha: "b1", size: 20 }]);

    const result = await expandSubmoduleEntries({
      regularEntries: [],
      submoduleEntries: [
        { path: "orgs/org-a", sha: "suba" },
        { path: "orgs/org-b", sha: "subb" },
      ],
      repo,
    });

    expect(result).toContainEqual({ path: "orgs/org-a", type: "tree", sha: "suba" });
    expect(result).toContainEqual({ path: "orgs/org-a/a.md", type: "blob", sha: "a1", size: 10 });
    expect(result).toContainEqual({ path: "orgs/org-b", type: "tree", sha: "subb" });
    expect(result).toContainEqual({ path: "orgs/org-b/b.md", type: "blob", sha: "b1", size: 20 });
  });

  it("passes correct repo context to getRepoGitModules", async () => {
    vi.mocked(getRepoGitModules).mockResolvedValue([]);

    await expandSubmoduleEntries({
      regularEntries: [],
      submoduleEntries: [{ path: "sub", sha: "s1" }],
      repo: { owner: "my-owner", repo: "my-repo", branch: "develop" },
    });

    expect(getRepoGitModules).toHaveBeenCalledWith({
      owner: "my-owner",
      repo: "my-repo",
      branch: "develop",
    });
  });
});
