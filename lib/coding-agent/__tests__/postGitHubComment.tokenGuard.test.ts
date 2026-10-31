import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postGitHubComment } from "../postGitHubComment";
import { handleGitHubWebhook } from "../handleGitHubWebhook";

const { getState, setState, triggerUpdate, verifyWebhook } = vi.hoisted(() => ({
  getState: vi.fn(),
  setState: vi.fn(),
  triggerUpdate: vi.fn(),
  verifyWebhook: vi.fn(),
}));

vi.mock("../verifyGitHubWebhook", () => ({
  verifyGitHubWebhook: verifyWebhook,
}));
vi.mock("../prState", () => ({
  getCodingAgentPRState: getState,
  setCodingAgentPRState: setState,
}));
vi.mock("@/lib/trigger/triggerUpdatePR", () => ({
  triggerUpdatePR: triggerUpdate,
}));

beforeEach(() => {
  vi.resetAllMocks();
  verifyWebhook.mockResolvedValue(true);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("GITHUB_WEBHOOK_SECRET", "synthetic-secret");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("postGitHubComment missing-token guard", () => {
  it.each([undefined, ""])("skips the request when GITHUB_TOKEN is %j", async token => {
    vi.stubEnv("GITHUB_TOKEN", token);

    await expect(
      postGitHubComment("example/repository", 12, "Synthetic feedback"),
    ).resolves.toBeUndefined();

    expect(fetch).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      "GITHUB_TOKEN environment variable is not set",
    );
  });

  it.each([undefined, ""])(
    "keeps an already-triggered update when the comment token is %j",
    async token => {
      vi.stubEnv("GITHUB_TOKEN", token);
      const originalState = {
        status: "pr_created",
        snapshotId: "synthetic-snapshot",
        branch: "synthetic-branch",
        repo: "example/repository",
        prs: [
          {
            repo: "example/repository",
            number: 12,
            url: "https://github.com/example/repository/pull/12",
            baseBranch: "main",
          },
        ],
      };
      getState.mockResolvedValue(originalState);
      setState.mockResolvedValue(undefined);
      triggerUpdate.mockResolvedValue({ id: "synthetic-run" });
      const payload = {
        action: "created",
        pull_request: { number: 12, head: { ref: "synthetic-branch" } },
        comment: { body: "@recoup-coding-agent fix the typo" },
        repository: { full_name: "example/repository" },
      };
      const request = new Request("https://example.test/api/webhooks/github", {
        method: "POST",
        headers: { "x-github-event": "pull_request_review_comment" },
        body: JSON.stringify(payload),
      });

      const response = await handleGitHubWebhook(request);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "update_triggered" });
      expect(triggerUpdate).toHaveBeenCalledTimes(1);
      expect(triggerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          feedback: "fix the typo",
          snapshotId: "synthetic-snapshot",
          branch: "synthetic-branch",
          repo: "example/repository",
        }),
      );
      expect(setState).toHaveBeenCalledExactlyOnceWith("example/repository", "synthetic-branch", {
        ...originalState,
        status: "updating",
      });
      expect(fetch).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        "GITHUB_TOKEN environment variable is not set",
      );
    },
  );

  it("preserves configured-token network rejection without retry", async () => {
    vi.stubEnv("GITHUB_TOKEN", "synthetic-token");
    const failure = new Error("Synthetic network failure");
    vi.mocked(fetch).mockRejectedValueOnce(failure);

    await expect(postGitHubComment("example/repository", 12, "Synthetic feedback")).rejects.toBe(
      failure,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
