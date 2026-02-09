import { describe, it, expect, vi, beforeEach } from "vitest";

import { findOrgReposByAccountId } from "../findOrgReposByAccountId";

describe("findOrgReposByAccountId", () => {
  const mockAccountId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    global.fetch = vi.fn();
  });

  it("returns matching repo URLs when repos contain the account ID", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { name: "artist-name-550e8400-e29b-41d4-a716-446655440000", html_url: "https://github.com/recoupable/artist-name-550e8400-e29b-41d4-a716-446655440000" },
        { name: "other-repo", html_url: "https://github.com/recoupable/other-repo" },
      ],
    } as Response);

    const result = await findOrgReposByAccountId(mockAccountId);

    expect(result).toEqual([
      "https://github.com/recoupable/artist-name-550e8400-e29b-41d4-a716-446655440000",
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://api.github.com/orgs/recoupable/repos"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("returns empty array when no repos match", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        { name: "unrelated-repo", html_url: "https://github.com/recoupable/unrelated-repo" },
      ],
    } as Response);

    const result = await findOrgReposByAccountId(mockAccountId);

    expect(result).toEqual([]);
  });

  it("returns empty array when GITHUB_TOKEN is not set", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");

    const result = await findOrgReposByAccountId(mockAccountId);

    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns empty array when GitHub API returns an error", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    const result = await findOrgReposByAccountId(mockAccountId);

    expect(result).toEqual([]);
  });

  it("returns empty array when fetch throws", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

    const result = await findOrgReposByAccountId(mockAccountId);

    expect(result).toEqual([]);
  });
});
