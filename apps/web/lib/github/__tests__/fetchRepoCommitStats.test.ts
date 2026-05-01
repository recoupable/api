import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetchLatestCommits = vi.fn();
vi.mock("../fetchLatestCommits", () => ({
  fetchLatestCommits: (...args: unknown[]) => mockFetchLatestCommits(...args),
}));

const mockFetchRepoCommitCount = vi.fn();
vi.mock("../fetchRepoCommitCount", () => ({
  fetchRepoCommitCount: (...args: unknown[]) => mockFetchRepoCommitCount(...args),
}));

const mockFetchEarliestCommit = vi.fn();
vi.mock("../fetchEarliestCommit", () => ({
  fetchEarliestCommit: (...args: unknown[]) => mockFetchEarliestCommit(...args),
}));

const { fetchRepoCommitStats } = await import("../fetchRepoCommitStats");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchRepoCommitStats", () => {
  it("returns null when latest commits fetch fails", async () => {
    mockFetchLatestCommits.mockResolvedValue(null);

    const result = await fetchRepoCommitStats("recoupable", "repo", "token");

    expect(result).toBeNull();
  });

  it("returns null when repo has no commits", async () => {
    mockFetchLatestCommits.mockResolvedValue([]);

    const result = await fetchRepoCommitStats("recoupable", "repo", "token");

    expect(result).toBeNull();
  });

  it("returns null when commit count fetch fails", async () => {
    mockFetchLatestCommits.mockResolvedValue([
      { commit: { message: "first", author: { date: "2025-01-01T00:00:00Z" }, committer: null } },
    ]);
    mockFetchRepoCommitCount.mockResolvedValue(null);

    const result = await fetchRepoCommitStats("recoupable", "repo", "token");

    expect(result).toBeNull();
  });

  it("returns stats without fetching earliest when totalCommits <= 5", async () => {
    mockFetchLatestCommits.mockResolvedValue([
      {
        commit: {
          message: "second\ndetails",
          author: { date: "2025-02-01T00:00:00Z" },
          committer: null,
        },
      },
      { commit: { message: "first", author: { date: "2025-01-01T00:00:00Z" }, committer: null } },
    ]);
    mockFetchRepoCommitCount.mockResolvedValue(2);

    const result = await fetchRepoCommitStats("recoupable", "repo", "token");

    expect(result).toEqual({
      total_commits: 2,
      latest_commit_messages: ["second", "first"],
      earliest_committed_at: "2025-01-01T00:00:00Z",
      latest_committed_at: "2025-02-01T00:00:00Z",
    });
    expect(mockFetchEarliestCommit).not.toHaveBeenCalled();
  });

  it("fetches earliest commit when totalCommits > 5", async () => {
    mockFetchLatestCommits.mockResolvedValue([
      { commit: { message: "latest", author: { date: "2025-06-01T00:00:00Z" }, committer: null } },
      { commit: { message: "older", author: { date: "2025-05-01T00:00:00Z" }, committer: null } },
    ]);
    mockFetchRepoCommitCount.mockResolvedValue(42);
    mockFetchEarliestCommit.mockResolvedValue({
      commit: { message: "initial", author: { date: "2024-01-01T00:00:00Z" }, committer: null },
    });

    const result = await fetchRepoCommitStats("recoupable", "repo", "token");

    expect(result).toEqual({
      total_commits: 42,
      latest_commit_messages: ["latest", "older"],
      earliest_committed_at: "2024-01-01T00:00:00Z",
      latest_committed_at: "2025-06-01T00:00:00Z",
    });
    expect(mockFetchEarliestCommit).toHaveBeenCalledWith("recoupable", "repo", "token", 42);
  });
});
