import { expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerCreateTaskTool } from "../registerCreateTaskTool";
import { registerUpdateTaskTool } from "../registerUpdateTaskTool";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";
import { buildPlanLimitBody } from "@/lib/plans/buildPlanLimitBody";
import { createTask } from "@/lib/tasks/createTask";
import { updateTask } from "@/lib/tasks/updateTask";

vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: async () => ({ accountId: "owner" }),
}));
vi.mock("@/lib/tasks/createTask", () => ({ createTask: vi.fn() }));
vi.mock("@/lib/tasks/updateTask", () => ({
  updateTask: vi.fn(),
  TASK_ACCESS_DENIED_MESSAGE: "Task access denied",
}));

it.each(["create_task", "update_task"])(
  "%s explains an entitlement failure without advertising plans",
  async name => {
    const body = buildPlanLimitBody({ plan: "free", limit: "task_count", currentTaskCount: 1 });
    vi.mocked(createTask).mockRejectedValue(new PlanLimitError(body));
    vi.mocked(updateTask).mockRejectedValue(new PlanLimitError(body));
    const server = new McpServer({ name: "task-commerce", version: "1" });
    registerCreateTaskTool(server);
    registerUpdateTaskTool(server);
    const client = new Client({ name: "test", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await server.connect(st);
    await client.connect(ct);
    try {
      const result = await client.callTool({
        name,
        arguments:
          name === "create_task"
            ? {
                title: "Weekly artist brief",
                prompt: "Summarize my artist's recent activity",
                schedule: "0 12 * * 1",
                artist_account_id: "a1111111-1111-4111-8111-111111111111",
              }
            : { id: "a1111111-1111-4111-8111-111111111111" },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toContain("current entitlements");
      expect(JSON.stringify(result)).not.toMatch(/Starter|Pro|billingUrl|checkoutUrl|https?:/);
      // REST clients still receive the original, separately documented plan body.
      expect(body.billingUrl).toContain("/plan");
    } finally {
      await client.close();
      await server.close();
    }
  },
);
