import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRepoCommitStats } from "../fetchRepoCommitStats";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchRepoCommitStats", () => {
  it("returns null when latest commits request fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await fetchRepoCommitStats("recoupable", "repo", "token");

    expect(result).toBeNull();
  });

  it("returns null when repo has no commits", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    const result = await fetchRepoCommitStats("recoupable", "repo", "token");

    expect(result).toBeNull();
  });

  it("returns stats for a repo with few commits", async () => {
    const commits = [
      { commit: { message: "second commit\ndetails", author: { date: "2025-02-01T00:00:00Z" }, committer: null } },
      { commit: { message: "first commit", author: { date: "2025-01-01T00:00:00Z" }, committer: null } },
    ];

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => commits }) // latest 5
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [commits[0]],
        headers: new Headers(), // no Link header = 1 page
      });

    const result = await fetchRepoCommitStats("recoupable", "repo", "token");

    expect(result).toEqual({
      total_commits: 1,
      latest_commit_messages: ["second commit", "first commit"],
      earliest_committed_at: "2025-01-01T00:00:00Z",
      latest_committed_at: "2025-02-01T00:00:00Z",
    });
  });
});
