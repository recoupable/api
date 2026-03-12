import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../verifyVercelWebhook", () => ({
  verifyVercelWebhook: vi.fn().mockReturnValue(true),
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

const { handleVercelWebhook } = await import("../handleVercelWebhook");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VERCEL_WEBHOOK_SECRET = "test-secret";
});

const BASE_PAYLOAD = {
  type: "deployment.error",
  id: "evt_abc123",
  createdAt: 1710000000000,
  payload: {
    team: { id: "team_abc" },
    user: { id: "user_xyz" },
    deployment: {
      id: "dpl_abc123",
      url: "my-app-abc123.vercel.app",
      name: "my-app",
      meta: {
        githubCommitRef: "agent/fix-bug",
        githubCommitOrg: "recoupable",
        githubCommitRepo: "api",
        githubCommitSha: "abc123",
      },
    },
    links: {
      deployment: "https://vercel.com/dashboard/deployments/dpl_abc123",
      project: "https://vercel.com/dashboard/projects/my-app",
    },
    target: "preview",
    project: { id: "prj_xyz" },
  },
};

/**
 * Creates a mock Vercel webhook request.
 *
 * @param body - The webhook payload
 * @param signature - The x-vercel-signature header value
 * @returns A mock Request object
 */
function makeRequest(body: unknown, signature = "valid") {
  return {
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers({
      "x-vercel-signature": signature,
    }),
  } as unknown as Request;
}

describe("handleVercelWebhook", () => {
  it("returns 401 when signature is invalid", async () => {
    const { verifyVercelWebhook } = await import("../verifyVercelWebhook");
    vi.mocked(verifyVercelWebhook).mockReturnValueOnce(false);

    const request = makeRequest(BASE_PAYLOAD);
    const response = await handleVercelWebhook(request);
    expect(response.status).toBe(401);
  });

  it("returns 200 with ignored for non-deployment.error events", async () => {
    const payload = { ...BASE_PAYLOAD, type: "deployment.succeeded" };
    const request = makeRequest(payload);
    const response = await handleVercelWebhook(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("ignored");
  });

  it("returns 200 with skipped when branch is missing from metadata", async () => {
    const payload = {
      ...BASE_PAYLOAD,
      payload: {
        ...BASE_PAYLOAD.payload,
        deployment: {
          ...BASE_PAYLOAD.payload.deployment,
          meta: {},
        },
      },
    };
    const request = makeRequest(payload);
    const response = await handleVercelWebhook(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("skipped");
    expect(json.reason).toContain("missing branch or repo");
  });

  it("returns 200 with skipped when no PR state exists", async () => {
    mockGetPRState.mockResolvedValue(null);

    const request = makeRequest(BASE_PAYLOAD);
    const response = await handleVercelWebhook(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("skipped");
    expect(json.reason).toContain("no PR state");
  });

  it("returns 200 with busy when state is running", async () => {
    mockGetPRState.mockResolvedValue({
      status: "running",
      branch: "agent/fix-bug",
      repo: "recoupable/api",
    });

    const request = makeRequest(BASE_PAYLOAD);
    const response = await handleVercelWebhook(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("busy");
  });

  it("returns 200 with busy when state is updating", async () => {
    mockGetPRState.mockResolvedValue({
      status: "updating",
      branch: "agent/fix-bug",
      repo: "recoupable/api",
    });

    const request = makeRequest(BASE_PAYLOAD);
    const response = await handleVercelWebhook(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("busy");
  });

  it("returns 200 with skipped when PR state is not eligible", async () => {
    mockGetPRState.mockResolvedValue({
      status: "merged",
      branch: "agent/fix-bug",
      repo: "recoupable/api",
    });

    const request = makeRequest(BASE_PAYLOAD);
    const response = await handleVercelWebhook(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("skipped");
  });

  it("triggers update-pr with Vercel CLI feedback when deployment fails", async () => {
    mockGetPRState.mockResolvedValue({
      status: "pr_created",
      snapshotId: "snap_abc",
      branch: "agent/fix-bug",
      repo: "recoupable/api",
      prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
    });

    const request = makeRequest(BASE_PAYLOAD);
    const response = await handleVercelWebhook(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("update_triggered");
    expect(json.deploymentId).toBe("dpl_abc123");

    expect(mockSetPRState).toHaveBeenCalledWith(
      "recoupable/api",
      "agent/fix-bug",
      expect.objectContaining({ status: "updating" }),
    );

    expect(mockTriggerUpdatePR).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotId: "snap_abc",
        branch: "agent/fix-bug",
        repo: "recoupable/api",
        callbackThreadId: "github:recoupable/api:42",
      }),
    );

    const feedback = mockTriggerUpdatePR.mock.calls[0][0].feedback;
    expect(feedback).toContain("Vercel deployment failed");
    expect(feedback).toContain("vercel inspect my-app-abc123.vercel.app --logs");
  });

  it("restores PR state when triggerUpdatePR fails", async () => {
    const originalState = {
      status: "pr_created" as const,
      snapshotId: "snap_abc",
      branch: "agent/fix-bug",
      repo: "recoupable/api",
      prs: [{ repo: "recoupable/api", number: 42, url: "url", baseBranch: "test" }],
    };
    mockGetPRState.mockResolvedValue({ ...originalState });
    mockTriggerUpdatePR.mockRejectedValueOnce(new Error("Trigger failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const request = makeRequest(BASE_PAYLOAD);
    const response = await handleVercelWebhook(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.status).toBe("error");

    expect(mockSetPRState).toHaveBeenCalledTimes(2);
    expect(mockSetPRState).toHaveBeenLastCalledWith(
      "recoupable/api",
      "agent/fix-bug",
      originalState,
    );
  });
});
