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
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("Not Found", { status: 404 }),
    );

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
    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ default_branch: "main" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tree: [] }), { status: 200 }),
      );

    await getRepoFileTree("https://github.com/owner/repo");

    expect(fetchSpy.mock.calls[0][1]?.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer test-token" }),
    );
  });

  it("uses the default branch from repo metadata", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ default_branch: "develop" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tree: [] }), { status: 200 }),
      );

    await getRepoFileTree("https://github.com/owner/repo");

    expect(fetchSpy.mock.calls[1][0]).toContain("/git/trees/develop?recursive=1");
  });
});
