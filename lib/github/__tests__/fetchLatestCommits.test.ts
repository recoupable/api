import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchLatestCommits } from "../fetchLatestCommits";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchLatestCommits", () => {
  it("returns commits on success", async () => {
    const commits = [
      {
        commit: {
          message: "feat: add thing",
          author: { date: "2025-02-01T00:00:00Z" },
          committer: null,
        },
      },
    ];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => commits });

    const result = await fetchLatestCommits("recoupable", "repo", "token", 5);

    expect(result).toEqual(commits);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/repo/commits?per_page=5",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  it("returns null when API fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await fetchLatestCommits("recoupable", "repo", "token", 5);

    expect(result).toBeNull();
  });
});
