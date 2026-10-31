import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleGitHubWebhook } from "@/lib/coding-agent/handleGitHubWebhook";
import { verifyGitHubWebhook } from "@/lib/coding-agent/verifyGitHubWebhook";
import { triggerUpdatePR } from "@/lib/trigger/triggerUpdatePR";
import { getCodingAgentPRState, setCodingAgentPRState } from "@/lib/coding-agent/prState";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));
vi.mock("@/lib/coding-agent/verifyGitHubWebhook", () => ({
  verifyGitHubWebhook: vi.fn(async () => true),
}));
vi.mock("@/lib/coding-agent/extractPRComment", () => ({
  extractPRComment: () => ({
    thread: { owner: "sample", repo: "repo", prNumber: 12 },
    branch: "feature",
    commentBody: "@recoup-coding-agent correct the typo",
  }),
}));
vi.mock("@/lib/coding-agent/prState", () => ({
  getCodingAgentPRState: vi.fn(),
  setCodingAgentPRState: vi.fn(),
}));
vi.mock("@/lib/trigger/triggerUpdatePR", () => ({ triggerUpdatePR: vi.fn() }));
const previous = {
  status: "pr_created",
  snapshotId: "synthetic-snapshot",
  branch: "feature",
  repo: "sample/repo",
  prs: [{ repo: "sample/repo", number: 12 }],
};
let current: typeof previous;
function request() {
  return new Request("https://review.invalid/api/github-feedback", {
    method: "POST",
    headers: { "x-github-event": "issue_comment", "x-hub-signature-256": "synthetic" },
    body: "{}",
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  current = { ...previous };
  vi.mocked(verifyGitHubWebhook).mockResolvedValue(true);
  vi.stubEnv("GITHUB_TOKEN", "synthetic-review-token");
  vi.stubEnv("GITHUB_WEBHOOK_SECRET", "synthetic-review-secret");
  vi.stubGlobal("fetch", vi.fn());
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getCodingAgentPRState).mockImplementation(async () => current as never);
  vi.mocked(setCodingAgentPRState).mockImplementation(async (_repo, _branch, state) => {
    current = state as typeof previous;
  });
  vi.mocked(triggerUpdatePR).mockResolvedValue({ id: "synthetic-accepted-run" } as never);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("confirmed feedback dispatch survives confirmation-comment failure", () => {
  it("keeps the accepted job busy after a failed HTTP comment response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("comment unavailable", { status: 503 }));
    const first = await handleGitHubWebhook(request());
    const second = await handleGitHubWebhook(request());
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ status: "update_triggered" });
    expect(await second.json()).toEqual({ status: "busy" });
    expect(triggerUpdatePR).toHaveBeenCalledTimes(1);
    expect(current.status).toBe("updating");
    expect(setCodingAgentPRState).toHaveBeenCalledTimes(1);
  });
  it("also keeps the accepted job busy when only comment transport rejects", async () => {
    vi.mocked(fetch).mockRejectedValue(
      new Error("synthetic connection failure after accepted dispatch"),
    );
    const first = await handleGitHubWebhook(request());
    const firstBody = await first.json();
    const second = await handleGitHubWebhook(request());
    const secondBody = await second.json();
    expect(triggerUpdatePR).toHaveBeenCalledTimes(1);
    expect(first.status).toBe(200);
    expect(firstBody).toEqual({ status: "update_triggered" });
    expect(secondBody).toEqual({ status: "busy" });
    expect(current.status).toBe("updating");
    expect(setCodingAgentPRState).toHaveBeenCalledTimes(1);
  });
  it("keeps the accepted job busy when reading a failed comment response rejects", async () => {
    const response = new Response("", { status: 503 });
    vi.spyOn(response, "text").mockRejectedValue(new Error("synthetic comment body read failure"));
    vi.mocked(fetch).mockResolvedValue(response);
    const first = await handleGitHubWebhook(request());
    const second = await handleGitHubWebhook(request());
    expect(triggerUpdatePR).toHaveBeenCalledTimes(1);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ status: "update_triggered" });
    expect(await second.json()).toEqual({ status: "busy" });
    expect(current.status).toBe("updating");
    expect(setCodingAgentPRState).toHaveBeenCalledTimes(1);
  });
  it("preserves existing rollback when the dispatch itself rejects", async () => {
    vi.mocked(triggerUpdatePR).mockRejectedValue(new Error("synthetic dispatch failure"));
    const response = await handleGitHubWebhook(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error", error: "Failed to trigger update" });
    expect(current).toEqual(previous);
    expect(setCodingAgentPRState).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  });
});
