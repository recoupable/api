import { describe, it, expect, vi, beforeEach } from "vitest";

import { createGithubRepo } from "../createGithubRepo";

const mockGetExistingGithubRepo = vi.fn();

vi.mock("../getExistingGithubRepo", () => ({
  getExistingGithubRepo: (...args: unknown[]) => mockGetExistingGithubRepo(...args),
}));

describe("createGithubRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("GITHUB_TOKEN", "test-token");
  });

  it("creates a repo and returns html_url", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ html_url: "https://github.com/recoupable/my-account-uuid123" }),
        { status: 201 },
      ),
    );

    const result = await createGithubRepo("My Account", "uuid123");

    expect(result).toBe("https://github.com/recoupable/my-account-uuid123");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/orgs/recoupable/repos",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "my-account-uuid123", private: true }),
      }),
    );
  });

  it("falls back to getExistingGithubRepo on 422", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("Already exists", { status: 422 }));
    mockGetExistingGithubRepo.mockResolvedValue("https://github.com/recoupable/my-account-uuid123");

    const result = await createGithubRepo("My Account", "uuid123");

    expect(result).toBe("https://github.com/recoupable/my-account-uuid123");
    expect(mockGetExistingGithubRepo).toHaveBeenCalledWith("my-account-uuid123");
  });

  it("returns undefined when GITHUB_TOKEN is missing", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    delete process.env.GITHUB_TOKEN;

    const result = await createGithubRepo("My Account", "uuid123");

    expect(result).toBeUndefined();
  });

  it("returns undefined on non-422 error", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("Server error", { status: 500 }));

    const result = await createGithubRepo("My Account", "uuid123");

    expect(result).toBeUndefined();
  });

  it("returns undefined on fetch error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const result = await createGithubRepo("My Account", "uuid123");

    expect(result).toBeUndefined();
  });

  it("sanitizes account name for repo name", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ html_url: "https://github.com/recoupable/my-account-uuid123" }),
        { status: 201 },
      ),
    );

    await createGithubRepo("My @Account!", "uuid123");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/orgs/recoupable/repos",
      expect.objectContaining({
        body: JSON.stringify({ name: "my-account-uuid123", private: true }),
      }),
    );
  });
});
