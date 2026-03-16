import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRepoCommitCount } from "../fetchRepoCommitCount";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchRepoCommitCount", () => {
  it("returns total commit count from Link header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{}],
      headers: new Headers({
        Link: '<https://api.github.com/repos/recoupable/repo/commits?per_page=1&page=2>; rel="next", <https://api.github.com/repos/recoupable/repo/commits?per_page=1&page=42>; rel="last"',
      }),
    });

    const result = await fetchRepoCommitCount("recoupable", "repo", "token");

    expect(result).toBe(42);
  });

  it("returns 1 when no Link header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{}],
      headers: new Headers(),
    });

    const result = await fetchRepoCommitCount("recoupable", "repo", "token");

    expect(result).toBe(1);
  });

  it("returns null when API fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await fetchRepoCommitCount("recoupable", "repo", "token");

    expect(result).toBeNull();
  });
});
