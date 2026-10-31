import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeGithubBranch } from "../mergeGithubBranch";
import { registerOnMergeTestToMainAction } from "../handlers/onMergeTestToMainAction";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  vi.stubEnv("GITHUB_TOKEN", "test-token");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("mergeGithubBranch failed HTTP responses", () => {
  it.each([
    ["plain text", "upstream-canary: unavailable"],
    ["HTML", "<html>upstream-canary: bad gateway</html>"],
    ["empty body", ""],
    ["malformed JSON", '{"message":'],
    ["JSON null", "null"],
    ["missing message", '{"error":"upstream-canary"}'],
    ["non-string message", '{"message":{"detail":"upstream-canary"}}'],
    ["blank message", '{"message":"   "}'],
    ["JSON array", '[{"message":"upstream-canary"}]'],
  ])("returns a structured failure for %s without leaking the raw body", async (_label, body) => {
    vi.mocked(fetch).mockResolvedValue(new Response(body, { status: 502 }));

    await expect(
      mergeGithubBranch("recoupable/api", "feature", "main", "test-token"),
    ).resolves.toEqual({
      ok: false,
      message: "GitHub branch merge failed (HTTP 502)",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(body));
  });

  it("preserves an existing nonblank JSON message exactly", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ message: "  Not allowed  " }, { status: 405 }),
    );
    await expect(
      mergeGithubBranch("recoupable/api", "feature", "main", "test-token"),
    ).resolves.toEqual({
      ok: false,
      message: "  Not allowed  ",
    });
  });

  it("preserves network failures without retrying or inventing a merge result", async () => {
    const error = new Error("connection lost");
    vi.mocked(fetch).mockRejectedValue(error);
    await expect(mergeGithubBranch("recoupable/api", "feature", "main", "test-token")).rejects.toBe(
      error,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves body-read failures outside the JSON parsing boundary", async () => {
    const error = new Error("body stream interrupted");
    const response = new Response("", { status: 502 });
    vi.spyOn(response, "text").mockRejectedValue(error);
    vi.mocked(fetch).mockResolvedValue(response);
    await expect(mergeGithubBranch("recoupable/api", "feature", "main", "test-token")).rejects.toBe(
      error,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("lets the actual action handler report an HTML failure without posting success", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 503 }));
    const onAction = vi.fn();
    registerOnMergeTestToMainAction({ onAction } as unknown as Parameters<
      typeof registerOnMergeTestToMainAction
    >[0]);
    const handler = onAction.mock.calls[0][0];
    const thread = {
      post: vi.fn(),
      setState: vi.fn(),
    };

    await expect(
      handler({ thread, actionId: "merge_test_to_main:recoupable/api" }),
    ).resolves.toBeUndefined();
    expect(thread.post).toHaveBeenCalledExactlyOnceWith(
      "❌ Failed to merge test → main for recoupable/api: GitHub branch merge failed (HTTP 503)",
    );
    expect(thread.setState).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "https://api.github.com/repos/recoupable/api/merges",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer test-token",
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          base: "main",
          head: "test",
          commit_message: "Merge test into main",
        }),
      },
    );
  });
});
