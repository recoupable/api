import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeGithubBranch } from "../mergeGithubBranch";

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mergeGithubBranch", () => {
  it("merges a branch and returns ok", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 201 } as Response);

    const result = await mergeGithubBranch("recoupable/api", "test", "main", "ghp_test");

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/api/merges",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          base: "main",
          head: "test",
          commit_message: "Merge test into main",
        }),
      }),
    );
  });

  it("returns ok when already up to date (204)", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 204 } as Response);

    const result = await mergeGithubBranch("recoupable/chat", "test", "main", "ghp_test");

    expect(result).toEqual({ ok: true });
  });

  it("returns error message on failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      text: () => Promise.resolve(JSON.stringify({ message: "Merge conflict" })),
    } as any);

    const result = await mergeGithubBranch("recoupable/api", "test", "main", "ghp_test");

    expect(result).toEqual({ ok: false, message: "Merge conflict" });
    consoleSpy.mockRestore();
  });
});
