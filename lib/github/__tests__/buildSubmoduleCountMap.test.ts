import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetOrgRepoUrls = vi.fn();
vi.mock("../getOrgRepoUrls", () => ({
  getOrgRepoUrls: (...args: unknown[]) => mockGetOrgRepoUrls(...args),
}));

const { buildSubmoduleCountMap } = await import("../buildSubmoduleCountMap");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildSubmoduleCountMap", () => {
  it("returns empty map for empty input", async () => {
    const result = await buildSubmoduleCountMap([]);
    expect(result.size).toBe(0);
  });

  it("counts submodule occurrences across repos", async () => {
    mockGetOrgRepoUrls
      .mockResolvedValueOnce(["https://github.com/recoupable/chat.git", "https://github.com/recoupable/api.git"])
      .mockResolvedValueOnce(["https://github.com/recoupable/chat.git"]);

    const result = await buildSubmoduleCountMap(["repo-url-1", "repo-url-2"]);

    expect(result.get("https://github.com/recoupable/chat")).toBe(2);
    expect(result.get("https://github.com/recoupable/api")).toBe(1);
  });

  it("skips repos that throw errors", async () => {
    mockGetOrgRepoUrls
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValueOnce(["https://github.com/recoupable/chat.git"]);

    const result = await buildSubmoduleCountMap(["bad-url", "good-url"]);

    expect(result.size).toBe(1);
    expect(result.get("https://github.com/recoupable/chat")).toBe(1);
  });
});
