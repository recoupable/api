import { describe, it, expect, vi, beforeEach } from "vitest";
import { mergeGithubPR } from "../mergeGithubPR";

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mergeGithubPR", () => {
  it("squash-merges a PR and returns ok", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    const result = await mergeGithubPR("recoupable/api", 42, "ghp_test");

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/recoupable/api/pulls/42/merge",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ merge_method: "squash" }),
      }),
    );
  });

  it("returns error message on failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 405,
      text: () => Promise.resolve(JSON.stringify({ message: "Not allowed" })),
    } as any);

    const result = await mergeGithubPR("recoupable/api", 42, "ghp_test");

    expect(result).toEqual({ ok: false, message: "Not allowed" });
    consoleSpy.mockRestore();
  });
});
