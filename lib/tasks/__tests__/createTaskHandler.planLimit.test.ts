import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTaskHandler } from "@/lib/tasks/createTaskHandler";
import { validateCreateTaskRequest } from "@/lib/tasks/validateCreateTaskRequest";
import { createTask } from "@/lib/tasks/createTask";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";
import { buildPlanLimitBody } from "@/lib/plans/buildPlanLimitBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: vi.fn(() => ({})) }));
vi.mock("@/lib/tasks/validateCreateTaskRequest", () => ({ validateCreateTaskRequest: vi.fn() }));
vi.mock("@/lib/tasks/createTask", () => ({ createTask: vi.fn() }));

describe("createTaskHandler plan_limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("maps PlanLimitError to 402 with the documented body", async () => {
    vi.mocked(validateCreateTaskRequest).mockResolvedValue({} as never);
    const body = buildPlanLimitBody({ plan: "free", limit: "task_count", currentTaskCount: 1 });
    vi.mocked(createTask).mockRejectedValue(new PlanLimitError(body));
    const res = await createTaskHandler(
      new NextRequest("http://localhost/api/tasks", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(402);
    await expect(res.json()).resolves.toEqual(body);
  });
});
