import { describe, it, expect, vi, beforeEach } from "vitest";

import { getExistingGithubRepo } from "../getExistingGithubRepo";

describe("getExistingGithubRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("GITHUB_TOKEN", "test-token");
  });

  it("returns html_url on success", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ html_url: "https://github.com/recoupable/my-repo" }), {
        status: 200,
      }),
    );

    const result = await getExistingGithubRepo("my-repo");

    expect(result).toBe("https://github.com/recoupable/my-repo");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/my-repo",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("returns undefined when GITHUB_TOKEN is missing", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    delete process.env.GITHUB_TOKEN;

    const result = await getExistingGithubRepo("my-repo");

    expect(result).toBeUndefined();
  });

  it("returns undefined on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("Not found", { status: 404 }));

    const result = await getExistingGithubRepo("missing-repo");

    expect(result).toBeUndefined();
  });

  it("returns undefined on fetch error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const result = await getExistingGithubRepo("my-repo");

    expect(result).toBeUndefined();
  });
});
