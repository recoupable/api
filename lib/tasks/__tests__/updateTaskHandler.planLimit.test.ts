import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateTaskHandler } from "@/lib/tasks/updateTaskHandler";
import { validateUpdateTaskRequest } from "@/lib/tasks/validateUpdateTaskRequest";
import { updateTask } from "@/lib/tasks/updateTask";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";
import { buildPlanLimitBody } from "@/lib/plans/buildPlanLimitBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/tasks/validateUpdateTaskRequest", () => ({ validateUpdateTaskRequest: vi.fn() }));
vi.mock("@/lib/tasks/updateTask", () => ({
  updateTask: vi.fn(),
  TASK_ACCESS_DENIED_MESSAGE: "Access denied to this task",
}));
vi.mock("@/lib/tasks/enrichTasks", () => ({ enrichTasks: vi.fn() }));

describe("updateTaskHandler plan_limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("maps PlanLimitError to 402 with the documented body", async () => {
    vi.mocked(validateUpdateTaskRequest).mockResolvedValue({} as never);
    const body = buildPlanLimitBody({ plan: "starter", limit: "min_cadence", currentTaskCount: 2 });
    vi.mocked(updateTask).mockRejectedValue(new PlanLimitError(body));
    const res = await updateTaskHandler(
      new NextRequest("http://localhost/api/tasks", { method: "PATCH", body: "{}" }),
    );
    expect(res.status).toBe(402);
    await expect(res.json()).resolves.toEqual(body);
  });
});
