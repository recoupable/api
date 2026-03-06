import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getRepoGitModules } from "../getRepoGitModules";

describe("getRepoGitModules", () => {
  const originalToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GITHUB_TOKEN = "test-token";
  });

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalToken;
  });

  it("fetches and parses .gitmodules", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        `[submodule "orgs/my-org"]\n\tpath = orgs/my-org\n\turl = https://github.com/recoupable/org-abc`,
        { status: 200 },
      ),
    );

    const result = await getRepoGitModules({ owner: "owner", repo: "repo", branch: "main" });

    expect(result).toEqual([{ path: "orgs/my-org", url: "https://github.com/recoupable/org-abc" }]);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/contents/.gitmodules?ref=main",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });

  it("returns null when fetch fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

    const result = await getRepoGitModules({ owner: "owner", repo: "repo", branch: "main" });

    expect(result).toBeNull();
  });

  it("works without GITHUB_TOKEN", async () => {
    delete process.env.GITHUB_TOKEN;
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        `[submodule "sub"]\n\tpath = sub\n\turl = https://github.com/owner/sub`,
        { status: 200 },
      ),
    );

    const result = await getRepoGitModules({ owner: "owner", repo: "repo", branch: "develop" });

    expect(result).toEqual([{ path: "sub", url: "https://github.com/owner/sub" }]);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/contents/.gitmodules?ref=develop",
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/vnd.github.v3.raw" }),
      }),
    );
  });
});
