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

  it("lists parent repos for each submodule", async () => {
    mockGetOrgRepoUrls
      .mockResolvedValueOnce(["https://github.com/recoupable/chat.git", "https://github.com/recoupable/api.git"])
      .mockResolvedValueOnce(["https://github.com/recoupable/chat.git"]);

    const result = await buildSubmoduleRepoMap(["repo-url-1", "repo-url-2"]);

    expect(result.get("https://github.com/recoupable/chat")).toEqual(["repo-url-1", "repo-url-2"]);
    expect(result.get("https://github.com/recoupable/api")).toEqual(["repo-url-1"]);
  });

  it("skips repos that throw errors", async () => {
    mockGetOrgRepoUrls
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce(["https://github.com/recoupable/chat.git"]);

    const result = await buildSubmoduleRepoMap(["bad-url", "good-url"]);

    expect(result.size).toBe(1);
    expect(result.get("https://github.com/recoupable/chat")).toEqual(["good-url"]);
  });
});
