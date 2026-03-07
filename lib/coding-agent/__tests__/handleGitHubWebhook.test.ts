import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../verifyGitHubWebhook", () => ({
  verifyGitHubWebhook: vi.fn().mockResolvedValue(true),
}));

const mockGetPRState = vi.fn();
const mockSetPRState = vi.fn();
vi.mock("../prState", () => ({
  getCodingAgentPRState: (...args: unknown[]) => mockGetPRState(...args),
  setCodingAgentPRState: (...args: unknown[]) => mockSetPRState(...args),
}));

const mockTriggerUpdatePR = vi.fn().mockResolvedValue({ id: "run_123" });
vi.mock("@/lib/trigger/triggerUpdatePR", () => ({
  triggerUpdatePR: (...args: unknown[]) => mockTriggerUpdatePR(...args),
}));

global.fetch = vi.fn();

const { handleGitHubWebhook } = await import("../handleGitHubWebhook");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_WEBHOOK_SECRET = "test-secret";
  process.env.GITHUB_TOKEN = "ghp_test";
});

const BASE_PAYLOAD = {
  action: "created",
  issue: {
    number: 66,
    pull_request: { url: "https://api.github.com/repos/recoupable/tasks/pulls/66" },
  },
  comment: {
    body: "@recoup-coding-agent make the button blue",
    user: { login: "sweetmantech" },
  },
  repository: {
    full_name: "recoupable/tasks",
  },
};

function makeRequest(body: unknown, event = "issue_comment", signature = "valid") {
  return {
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers({
      "x-github-event": event,
      "x-hub-signature-256": signature,
    }),
  } as unknown as Request;
}

describe("handleGitHubWebhook", () => {
  it("returns 401 when signature is invalid", async () => {
    const { verifyGitHubWebhook } = await import("../verifyGitHubWebhook");
    vi.mocked(verifyGitHubWebhook).mockResolvedValueOnce(false);

    const request = makeRequest(BASE_PAYLOAD);
    const response = await handleGitHubWebhook(request);
    expect(response.status).toBe(401);
  });

  it("returns 200 with ignored for non-issue_comment events", async () => {
    const request = makeRequest(BASE_PAYLOAD, "push");
    const response = await handleGitHubWebhook(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("ignored");
  });

  it("returns 200 with ignored when action is not created", async () => {
    const request = makeRequest({ ...BASE_PAYLOAD, action: "deleted" });
    const response = await handleGitHubWebhook(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("ignored");
  });

  it("returns 200 with ignored when issue has no pull_request", async () => {
    const payload = {
      ...BASE_PAYLOAD,
      issue: { number: 66 },
    };
    const request = makeRequest(payload);
    const response = await handleGitHubWebhook(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("ignored");
  });

  it("returns 200 with ignored when bot is not mentioned", async () => {
    const payload = {
      ...BASE_PAYLOAD,
      comment: { body: "just a regular comment", user: { login: "sweetmantech" } },
    };
    const request = makeRequest(payload);
    const response = await handleGitHubWebhook(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("ignored");
  });

  it("returns 200 with no_state when no shared PR state exists", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ head: { ref: "agent/fix-bug" } }),
    } as Response);
    mockGetPRState.mockResolvedValue(null);

    const request = makeRequest(BASE_PAYLOAD);
    const response = await handleGitHubWebhook(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("no_state");
  });

  it("returns 200 with busy when state is running", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ head: { ref: "agent/fix-bug" } }),
    } as Response);
    mockGetPRState.mockResolvedValue({
      status: "running",
      branch: "agent/fix-bug",
      repo: "recoupable/tasks",
    });

    const request = makeRequest(BASE_PAYLOAD);
    const response = await handleGitHubWebhook(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("busy");
  });

  it("triggers update-pr and posts GitHub comment when state is pr_created", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ head: { ref: "agent/fix-bug" } }),
    } as Response);
    mockGetPRState.mockResolvedValue({
      status: "pr_created",
      snapshotId: "snap_abc",
      branch: "agent/fix-bug",
      repo: "recoupable/tasks",
      prs: [{ repo: "recoupable/tasks", number: 66, url: "url", baseBranch: "main" }],
    });
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    const request = makeRequest(BASE_PAYLOAD);
    const response = await handleGitHubWebhook(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("update_triggered");

    expect(mockTriggerUpdatePR).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: "make the button blue",
        snapshotId: "snap_abc",
        branch: "agent/fix-bug",
        repo: "recoupable/tasks",
      }),
    );

    expect(mockSetPRState).toHaveBeenCalledWith(
      "recoupable/tasks",
      "agent/fix-bug",
      expect.objectContaining({ status: "updating" }),
    );
  });

  it("handles pull_request_review_comment events without fetching PR details", async () => {
    const reviewPayload = {
      action: "created",
      pull_request: {
        number: 266,
        head: { ref: "feature/my-branch" },
      },
      comment: {
        body: "@recoup-coding-agent fix the typo",
        user: { login: "sweetmantech" },
      },
      repository: {
        full_name: "recoupable/api",
      },
    };
    mockGetPRState.mockResolvedValue({
      status: "pr_created",
      snapshotId: "snap_xyz",
      branch: "feature/my-branch",
      repo: "recoupable/api",
      prs: [{ repo: "recoupable/api", number: 266, url: "url", baseBranch: "test" }],
    });
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    const request = makeRequest(reviewPayload, "pull_request_review_comment");
    const response = await handleGitHubWebhook(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("update_triggered");

    expect(mockTriggerUpdatePR).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback: "fix the typo",
        snapshotId: "snap_xyz",
        branch: "feature/my-branch",
        repo: "recoupable/api",
      }),
    );

    // Should NOT have fetched PR details — branch came from payload
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/pulls/266"),
      expect.anything(),
    );
  });
});
