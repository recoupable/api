import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/tasks/runs/route";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";

vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(async () => "owner"),
}));
vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: vi.fn(async () => "owner"),
}));
vi.mock("@/lib/admins/checkIsAdmin", () => ({ checkIsAdmin: vi.fn(async () => false) }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));
vi.mock("@/lib/trigger/retrieveTaskRun", () => ({ retrieveTaskRun: vi.fn() }));
vi.mock("@/lib/trigger/fetchTriggerRuns", () => ({ fetchTriggerRuns: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));

const request = (query = "", headers: Record<string, string> = { "x-api-key": "fixture-key" }) =>
  new NextRequest(`http://localhost:3000/api/tasks/runs?runId=run_1${query}`, { headers });
const providerRun = (accountId: string) =>
  ({
    id: "run_1",
    status: "COMPLETED",
    payload: { accountId },
    output: { private: "output" },
  }) as NonNullable<Awaited<ReturnType<typeof retrieveTaskRun>>>;

beforeEach(() => vi.resetAllMocks());

describe("GET /api/tasks/runs account access", () => {
  it.each([{ "x-api-key": "fixture-key" }, { Authorization: "Bearer fixture-token" }])(
    "returns the owned run through the exported route using %j",
    async headers => {
      const job = providerRun("owner");
      vi.mocked(retrieveTaskRun).mockResolvedValue(job);
      const response = await GET(request("", headers));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "success", runs: [job] });
      expect(retrieveTaskRun).toHaveBeenCalledExactlyOnceWith("run_1");
    },
  );

  it("returns exactly the inaccessible response for a foreign run", async () => {
    vi.mocked(retrieveTaskRun).mockResolvedValue(providerRun("other"));
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: "error", error: "Task run not found" });
  });

  it("uses the authorized account override for run ownership", async () => {
    const job = providerRun("member");
    vi.mocked(retrieveTaskRun).mockResolvedValue(job);
    vi.mocked(canAccessAccount).mockResolvedValue(true);
    const response = await GET(request("&account_id=member"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success", runs: [job] });
    expect(canAccessAccount).toHaveBeenCalledExactlyOnceWith({
      currentAccountId: "owner",
      targetAccountId: "member",
    });
  });

  it("rejects an unauthorized override before retrieving a run", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(false);
    const response = await GET(request("&account_id=other"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Access denied to specified account_id",
    });
    expect(retrieveTaskRun).not.toHaveBeenCalled();
  });

  it("requires credentials before retrieving a run", async () => {
    const response = await GET(request("", {}));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
    expect(retrieveTaskRun).not.toHaveBeenCalled();
  });
});
