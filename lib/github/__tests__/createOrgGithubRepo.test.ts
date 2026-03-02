import { describe, it, expect, vi, beforeEach } from "vitest";

import { createOrgGithubRepo } from "../createOrgGithubRepo";

const mockGetExistingGithubRepo = vi.fn();

vi.mock("../getExistingGithubRepo", () => ({
  getExistingGithubRepo: (...args: unknown[]) => mockGetExistingGithubRepo(...args),
}));

describe("createOrgGithubRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("GITHUB_TOKEN", "test-token");
  });

  it("creates a repo with auto_init and org- prefix", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ html_url: "https://github.com/recoupable/org-my-org-org123" }),
        { status: 201 },
      ),
    );

    const result = await createOrgGithubRepo("My Org", "org123");

    expect(result).toBe("https://github.com/recoupable/org-my-org-org123");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/orgs/recoupable/repos",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "org-my-org-org123",
          private: true,
          auto_init: true,
        }),
      }),
    );
  });

  it("falls back to getExistingGithubRepo on 422", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("Already exists", { status: 422 }));
    mockGetExistingGithubRepo.mockResolvedValue("https://github.com/recoupable/org-my-org-org123");

    const result = await createOrgGithubRepo("My Org", "org123");

    expect(result).toBe("https://github.com/recoupable/org-my-org-org123");
    expect(mockGetExistingGithubRepo).toHaveBeenCalledWith("org-my-org-org123");
  });

  it("returns undefined when GITHUB_TOKEN is missing", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    delete process.env.GITHUB_TOKEN;

    const result = await createOrgGithubRepo("My Org", "org123");

    expect(result).toBeUndefined();
  });

  it("returns undefined on non-422 error", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("Server error", { status: 500 }));

    const result = await createOrgGithubRepo("My Org", "org123");

    expect(result).toBeUndefined();
  });
});
