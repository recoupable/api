import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetOrgRepoUrls = vi.fn();
vi.mock("../getOrgRepoUrls", () => ({
  getOrgRepoUrls: (...args: unknown[]) => mockGetOrgRepoUrls(...args),
}));

const { buildSubmoduleRepoMap } = await import("../buildSubmoduleRepoMap");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildSubmoduleRepoMap", () => {
  it("returns empty map for empty input", async () => {
    const result = await buildSubmoduleRepoMap([]);
    expect(result.size).toBe(0);
  });

  it("lists parent repo entries for each submodule", async () => {
    mockGetOrgRepoUrls
      .mockResolvedValueOnce(["https://github.com/recoupable/chat.git", "https://github.com/recoupable/api.git"])
      .mockResolvedValueOnce(["https://github.com/recoupable/chat.git"]);

    const result = await buildSubmoduleRepoMap([
      { account_id: "acc_1", github_repo: "repo-url-1" },
      { account_id: "acc_2", github_repo: "repo-url-2" },
    ]);

    expect(result.get("https://github.com/recoupable/chat")).toEqual([
      { account_id: "acc_1", repo_url: "repo-url-1" },
      { account_id: "acc_2", repo_url: "repo-url-2" },
    ]);
    expect(result.get("https://github.com/recoupable/api")).toEqual([
      { account_id: "acc_1", repo_url: "repo-url-1" },
    ]);
  });

  it("skips repos that throw errors", async () => {
    mockGetOrgRepoUrls
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce(["https://github.com/recoupable/chat.git"]);

    const result = await buildSubmoduleRepoMap([
      { account_id: "acc_bad", github_repo: "bad-url" },
      { account_id: "acc_good", github_repo: "good-url" },
    ]);

    expect(result.size).toBe(1);
    expect(result.get("https://github.com/recoupable/chat")).toEqual([
      { account_id: "acc_good", repo_url: "good-url" },
    ]);
  });
});
