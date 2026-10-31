import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFullOAuthTools } from "../registerFullOAuthTools";
import { executeFullOAuthTool } from "../executeFullOAuthTool";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";

vi.mock("../../tools", async () => {
  const { registerGetTaskRunStatusTool } = await import(
    "../../tools/tasks/registerGetTaskRunStatusTool"
  );
  return { registerAllTools: registerGetTaskRunStatusTool };
});
vi.mock("@/lib/trigger/retrieveTaskRun", () => ({ retrieveTaskRun: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/video/retrieveVideo", () => ({ retrieveVideoFunction: vi.fn() }));
vi.mock("@/lib/video/retrieveVideoContent", () => ({ retrieveVideoContentFunction: vi.fn() }));

const access = {
  accountId: "owner",
  clientId: "client",
  grantId: "grant",
  scopes: ["mcp:tools"],
  expiresAt: 9999999999,
  resource: "https://api.recoupable.dev/mcp",
  context: "personal" as const,
};
const extra = {
  authInfo: {
    token: "fixture-token",
    clientId: "client",
    scopes: access.scopes,
    extra: { accountId: "owner", oauth: access },
  },
};
const denied = {
  isError: true,
  content: [
    {
      type: "text",
      text: "Operation unavailable or permission denied. Check workspace access and reconnect with the full Recoup tools permission if needed.",
    },
  ],
};
const job = {
  id: "run_1",
  status: "COMPLETED",
  taskIdentifier: "scheduled-task",
  createdAt: "2026-10-17T00:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  payload: { accountId: "owner" },
  output: { private: "output" },
  metadata: { private: "metadata" },
};

function setup(current: unknown = access) {
  const handlers = new Map<string, any>();
  const server = { registerTool: vi.fn((name, _config, handler) => handlers.set(name, handler)) };
  const prepare = vi.fn(async (_name: string, args: Record<string, unknown>) => args);
  registerFullOAuthTools(server as unknown as McpServer, vi.fn().mockResolvedValue(current), {
    prepare,
    execute: executeFullOAuthTool,
    listArtists: vi.fn(),
  });
  return { run: handlers.get("get_task_run_status"), prepare };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(retrieveTaskRun).mockResolvedValue(
    job as unknown as Awaited<ReturnType<typeof retrieveTaskRun>>,
  );
});

describe("delegated get_task_run_status through full OAuth registration", () => {
  it("returns exactly the smaller status projection for the verified account", async () => {
    const { run, prepare } = setup();
    expect(await run({ runId: "run_1" }, extra)).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            id: job.id,
            status: job.status,
            taskIdentifier: job.taskIdentifier,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
          }),
        },
      ],
    });
    expect(prepare).toHaveBeenCalledExactlyOnceWith(
      "get_task_run_status",
      { runId: "run_1" },
      "owner",
    );
    expect(retrieveTaskRun).toHaveBeenCalledExactlyOnceWith("run_1");
  });

  it("hides all foreign run details through the registered delegated tool", async () => {
    vi.mocked(retrieveTaskRun).mockResolvedValue({
      ...job,
      payload: { accountId: "other" },
    } as unknown as Awaited<ReturnType<typeof retrieveTaskRun>>);
    expect(await setup().run({ runId: "run_1" }, extra)).toEqual(denied);
  });

  it.each([
    null,
    { ...access, scopes: ["mcp:read"] },
    { ...access, accountId: "other" },
    { ...access, grantId: "revoked" },
    { ...access, clientId: "other" },
  ])("rejects invalid delegated authority before provider retrieval: %j", async current => {
    const { run, prepare } = setup(current);
    expect(await run({ runId: "run_1" }, extra)).toEqual(denied);
    expect(prepare).not.toHaveBeenCalled();
    expect(retrieveTaskRun).not.toHaveBeenCalled();
  });

  it("does not accept a caller-supplied account override", async () => {
    const { run, prepare } = setup();
    expect(await run({ runId: "run_1", account_id: "other" }, extra)).toEqual({
      isError: true,
      content: [
        { type: "text", text: "Invalid tool arguments. Check the tool schema and try again." },
      ],
    });
    expect(prepare).not.toHaveBeenCalled();
    expect(retrieveTaskRun).not.toHaveBeenCalled();
  });
});
