import { describe, it, expect, vi, beforeEach } from "vitest";

global.fetch = vi.fn();

const { postGitHubComment } = await import("../postGitHubComment");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_TOKEN = "ghp_test";
});

describe("postGitHubComment", () => {
  it("posts a comment to the correct GitHub API endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    await postGitHubComment("recoupable/tasks", 68, "Hello from bot");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/tasks/issues/68/comments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ body: "Hello from bot" }),
      }),
    );
  });

  it("includes auth headers", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    await postGitHubComment("recoupable/api", 10, "test");

    const call = vi.mocked(fetch).mock.calls[0];
    const opts = call[1] as RequestInit;
    const headers = opts.headers as Record<string, string>;
    expect(headers.Authorization).toBe("token ghp_test");
    expect(headers.Accept).toBe("application/vnd.github+json");
  });

  it("logs error when fetch fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve("Forbidden"),
    } as Response);

    await postGitHubComment("recoupable/tasks", 68, "test");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to post GitHub comment"),
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });
});
