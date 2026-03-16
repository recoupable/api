import { describe, it, expect, vi, beforeEach } from "vitest";
import { listOrgRepos } from "../listOrgRepos";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listOrgRepos", () => {
  it("returns repos from a single page", async () => {
    const repos = [{ name: "repo-1", html_url: "https://github.com/recoupable/repo-1" }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => repos,
    });

    const result = await listOrgRepos("test-token");

    expect(result).toEqual(repos);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("paginates when first page is full", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      name: `repo-${i}`,
      html_url: `https://github.com/recoupable/repo-${i}`,
    }));
    const page2 = [{ name: "repo-100", html_url: "https://github.com/recoupable/repo-100" }];

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 });

    const result = await listOrgRepos("test-token");

    expect(result).toHaveLength(101);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns empty array when API fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await listOrgRepos("test-token");

    expect(result).toEqual([]);
  });
});
