import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getTasksHandler } from "@/lib/tasks/getTasksHandler";
import { validateGetTasksQuery } from "@/lib/tasks/validateGetTasksQuery";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { enrichTasks } from "@/lib/tasks/enrichTasks";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/tasks/validateGetTasksQuery", () => ({
  validateGetTasksQuery: vi.fn(),
}));

vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));

vi.mock("@/lib/tasks/enrichTasks", () => ({
  enrichTasks: vi.fn(),
}));

describe("getTasksHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns enriched tasks with owner_email", async () => {
    const validatedQuery = {
      account_id: "owner-1",
      artist_account_id: "artist-1",
    };

    const tasks = [
      {
        id: "task-1",
        account_id: "owner-1",
        artist_account_id: "artist-1",
        created_at: null,
        enabled: true,
        last_run: null,
        model: null,
        next_run: null,
        prompt: "prompt 1",
        schedule: "0 9 * * *",
        title: "Task One",
        trigger_schedule_id: null,
        updated_at: null,
      },
      {
        id: "task-2",
        account_id: "owner-2",
        artist_account_id: "artist-1",
        created_at: null,
        enabled: true,
        last_run: null,
        model: null,
        next_run: null,
        prompt: "prompt 2",
        schedule: "0 10 * * *",
        title: "Task Two",
        trigger_schedule_id: null,
        updated_at: null,
      },
    ];

    vi.mocked(validateGetTasksQuery).mockResolvedValue(validatedQuery);
    vi.mocked(selectScheduledActions).mockResolvedValue(tasks);
    vi.mocked(enrichTasks).mockResolvedValue([
      {
        ...tasks[0],
        recent_runs: [],
        upcoming: [],
        owner_email: "owner1@example.com",
      },
      {
        ...tasks[1],
        recent_runs: [],
        upcoming: [],
        owner_email: null,
      },
    ]);

    const request = new NextRequest("http://localhost:3000/api/tasks");
    const response = await getTasksHandler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(enrichTasks).toHaveBeenCalledWith(tasks);
    expect(body).toEqual({
      status: "success",
      tasks: [
        {
          ...tasks[0],
          recent_runs: [],
          upcoming: [],
          owner_email: "owner1@example.com",
        },
        {
          ...tasks[1],
          recent_runs: [],
          upcoming: [],
          owner_email: null,
        },
      ],
    });
  });

  it("returns validator errors directly", async () => {
    const errorResponse = NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401 },
    );
    vi.mocked(validateGetTasksQuery).mockResolvedValue(errorResponse);

    const request = new NextRequest("http://localhost:3000/api/tasks");
    const response = await getTasksHandler(request);

    expect(response).toBe(errorResponse);
    expect(selectScheduledActions).not.toHaveBeenCalled();
    expect(enrichTasks).not.toHaveBeenCalled();
  });
});
