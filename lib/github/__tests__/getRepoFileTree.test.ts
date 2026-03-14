import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getRepoFileTree } from "../getRepoFileTree";

describe("getRepoFileTree", () => {
  const originalToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GITHUB_TOKEN = "test-token";
  });

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalToken;
  });

  it("returns file tree entries on success", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            tree: [
              { path: "README.md", type: "blob", sha: "abc123", size: 100 },
              { path: "src", type: "tree", sha: "def456" },
              { path: "src/index.ts", type: "blob", sha: "ghi789", size: 250 },
            ],
          }),
          { status: 200 },
        ),
      );

    const result = await getRepoFileTree("https://github.com/owner/repo");

    expect(result).toEqual([
      { path: "README.md", type: "blob", sha: "abc123", size: 100 },
      { path: "src", type: "tree", sha: "def456" },
      { path: "src/index.ts", type: "blob", sha: "ghi789", size: 250 },
    ]);
  });

  it("returns null when GITHUB_TOKEN is not set", async () => {
    delete process.env.GITHUB_TOKEN;

    const result = await getRepoFileTree("https://github.com/owner/repo");

    expect(result).toBeNull();
  });

  it("returns null when URL parsing fails", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    const result = await getRepoFileTree("not-a-valid-url");

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null when repo metadata fetch fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

    const result = await getRepoFileTree("https://github.com/owner/repo");

    expect(result).toBeNull();
  });

  it("returns null when tree fetch fails", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response("Server Error", { status: 500 }));

    const result = await getRepoFileTree("https://github.com/owner/repo");

    expect(result).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const result = await getRepoFileTree("https://github.com/owner/repo");

    expect(result).toBeNull();
  });

  it("passes correct Authorization header", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ tree: [] }), { status: 200 }));

    await getRepoFileTree("https://github.com/owner/repo");

    expect(fetchSpy.mock.calls[0][1]?.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer test-token" }),
    );
  });

  it("uses the default branch from repo metadata", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ default_branch: "develop" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ tree: [] }), { status: 200 }));

    await getRepoFileTree("https://github.com/owner/repo");

    expect(fetchSpy.mock.calls[1][0]).toContain("/git/trees/develop?recursive=1");
  });

  describe("submodule expansion", () => {
    const gitmodulesContent = `[submodule ".openclaw/workspace/orgs/my-org"]
\tpath = .openclaw/workspace/orgs/my-org
\turl = https://github.com/recoupable/org-my-org-abc123`;

    it("expands submodule entries into directories with contents", async () => {
      vi.spyOn(global, "fetch")
        // Parent repo metadata
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
        )
        // Parent tree (includes a commit entry for the submodule)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              tree: [
                { path: "README.md", type: "blob", sha: "abc123", size: 50 },
                { path: ".openclaw/workspace/orgs/my-org", type: "commit", sha: "sub111" },
                { path: ".openclaw", type: "tree", sha: "claw1" },
                { path: ".openclaw/workspace", type: "tree", sha: "ws1" },
                { path: ".openclaw/workspace/orgs", type: "tree", sha: "orgs1" },
              ],
            }),
            { status: 200 },
          ),
        )
        // .gitmodules fetch
        .mockResolvedValueOnce(new Response(gitmodulesContent, { status: 200 }))
        // Submodule repo metadata
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
        )
        // Submodule tree
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              tree: [
                { path: "artist.md", type: "blob", sha: "art1", size: 200 },
                { path: "data", type: "tree", sha: "data1" },
                { path: "data/info.json", type: "blob", sha: "info1", size: 80 },
              ],
            }),
            { status: 200 },
          ),
        );

      const result = await getRepoFileTree("https://github.com/owner/repo");

      expect(result).toEqual([
        { path: "README.md", type: "blob", sha: "abc123", size: 50 },
        { path: ".openclaw", type: "tree", sha: "claw1" },
        { path: ".openclaw/workspace", type: "tree", sha: "ws1" },
        { path: ".openclaw/workspace/orgs", type: "tree", sha: "orgs1" },
        // Submodule converted to a tree entry
        { path: ".openclaw/workspace/orgs/my-org", type: "tree", sha: "sub111" },
        // Submodule contents prefixed with submodule path
        { path: ".openclaw/workspace/orgs/my-org/artist.md", type: "blob", sha: "art1", size: 200 },
        { path: ".openclaw/workspace/orgs/my-org/data", type: "tree", sha: "data1" },
        {
          path: ".openclaw/workspace/orgs/my-org/data/info.json",
          type: "blob",
          sha: "info1",
          size: 80,
        },
      ]);
    });

    it("converts submodule to empty directory when .gitmodules fetch fails", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              tree: [
                { path: "README.md", type: "blob", sha: "abc123", size: 50 },
                { path: ".openclaw/workspace/orgs/my-org", type: "commit", sha: "sub111" },
              ],
            }),
            { status: 200 },
          ),
        )
        // .gitmodules fetch fails
        .mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

      const result = await getRepoFileTree("https://github.com/owner/repo");

      expect(result).toEqual([
        { path: "README.md", type: "blob", sha: "abc123", size: 50 },
        { path: ".openclaw/workspace/orgs/my-org", type: "tree", sha: "sub111" },
      ]);
    });

    it("converts submodule to empty directory when URL not in .gitmodules", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              tree: [{ path: "unknown-submodule", type: "commit", sha: "sub222" }],
            }),
            { status: 200 },
          ),
        )
        // .gitmodules has different submodule
        .mockResolvedValueOnce(new Response(gitmodulesContent, { status: 200 }));

      const result = await getRepoFileTree("https://github.com/owner/repo");

      expect(result).toEqual([{ path: "unknown-submodule", type: "tree", sha: "sub222" }]);
    });

    it("converts submodule to empty directory when submodule tree fetch fails", async () => {
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              tree: [{ path: ".openclaw/workspace/orgs/my-org", type: "commit", sha: "sub111" }],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(new Response(gitmodulesContent, { status: 200 }))
        // Submodule repo metadata fails
        .mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

      const result = await getRepoFileTree("https://github.com/owner/repo");

      expect(result).toEqual([
        { path: ".openclaw/workspace/orgs/my-org", type: "tree", sha: "sub111" },
      ]);
    });

    it("expands multiple submodules in parallel", async () => {
      const multiGitmodules = `[submodule ".openclaw/workspace/orgs/org-a"]
\tpath = .openclaw/workspace/orgs/org-a
\turl = https://github.com/recoupable/org-a-111
[submodule ".openclaw/workspace/orgs/org-b"]
\tpath = .openclaw/workspace/orgs/org-b
\turl = https://github.com/recoupable/org-b-222`;

      vi.spyOn(global, "fetch")
        // Parent repo metadata
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
        )
        // Parent tree
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              tree: [
                { path: ".openclaw/workspace/orgs/org-a", type: "commit", sha: "suba" },
                { path: ".openclaw/workspace/orgs/org-b", type: "commit", sha: "subb" },
              ],
            }),
            { status: 200 },
          ),
        )
        // .gitmodules
        .mockResolvedValueOnce(new Response(multiGitmodules, { status: 200 }))
        // Submodule A repo metadata
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
        )
        // Submodule B repo metadata (parallel)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
        )
        // Submodule A tree
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              tree: [{ path: "file-a.md", type: "blob", sha: "fa1", size: 10 }],
            }),
            { status: 200 },
          ),
        )
        // Submodule B tree
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              tree: [{ path: "file-b.md", type: "blob", sha: "fb1", size: 20 }],
            }),
            { status: 200 },
          ),
        );

      const result = await getRepoFileTree("https://github.com/owner/repo");

      expect(result).toContainEqual({
        path: ".openclaw/workspace/orgs/org-a",
        type: "tree",
        sha: "suba",
      });
      expect(result).toContainEqual({
        path: ".openclaw/workspace/orgs/org-a/file-a.md",
        type: "blob",
        sha: "fa1",
        size: 10,
      });
      expect(result).toContainEqual({
        path: ".openclaw/workspace/orgs/org-b",
        type: "tree",
        sha: "subb",
      });
      expect(result).toContainEqual({
        path: ".openclaw/workspace/orgs/org-b/file-b.md",
        type: "blob",
        sha: "fb1",
        size: 20,
      });
    });
  });
});
