import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchEarliestCommit } from "../fetchEarliestCommit";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchEarliestCommit", () => {
  it("returns earliest commit on success", async () => {
    const commit = { commit: { message: "initial", author: { date: "2024-01-01T00:00:00Z" }, committer: null } };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [commit] });

    const result = await fetchEarliestCommit("recoupable", "repo", "token", 42);

    expect(result).toEqual(commit);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/repo/commits?per_page=1&page=42",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  it("returns null when API fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await fetchEarliestCommit("recoupable", "repo", "token", 42);

    expect(result).toBeNull();
  });

  it("returns null when response has no commits", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    const result = await fetchEarliestCommit("recoupable", "repo", "token", 42);

    expect(result).toBeNull();
  });
});
