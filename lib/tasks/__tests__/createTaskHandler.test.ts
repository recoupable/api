import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createTaskHandler } from "@/lib/tasks/createTaskHandler";
import { validateCreateTaskRequest } from "@/lib/tasks/validateCreateTaskRequest";
import { createTask } from "@/lib/tasks/createTask";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/tasks/validateCreateTaskRequest", () => ({
  validateCreateTaskRequest: vi.fn(),
}));
vi.mock("@/lib/tasks/createTask", () => ({ createTask: vi.fn() }));

const ACCOUNT_A = "123e4567-e89b-12d3-a456-426614174000";
const ARTIST_ID = "323e4567-e89b-12d3-a456-426614174000";
const validated = () => ({
  title: "Daily report",
  prompt: "Summarize fans",
  schedule: "0 9 * * *",
  account_id: ACCOUNT_A,
  artist_account_id: ARTIST_ID,
});

describe("createTaskHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.mocked(console.error).mockRestore());

  it("returns validateCreateTaskRequest error unchanged", async () => {
    const err = NextResponse.json({ status: "error", error: "nope" }, { status: 403 });
    vi.mocked(validateCreateTaskRequest).mockResolvedValue(err);
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: "{}",
    });
    expect(await createTaskHandler(request)).toBe(err);
    expect(createTask).not.toHaveBeenCalled();
  });

  it("returns 200 when create succeeds", async () => {
    const v = validated();
    vi.mocked(validateCreateTaskRequest).mockResolvedValue(v);
    const created = { id: "sched-1", ...v } as Awaited<ReturnType<typeof createTask>>;
    vi.mocked(createTask).mockResolvedValue(created);
    const request = new NextRequest("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": "k" },
      body: "{}",
    });
    const res = await createTaskHandler(request);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "success", tasks: [created] });
    expect(createTask).toHaveBeenCalledWith(v);
  });

  it.each([
    [new Error("Trigger failure"), "Trigger failure"],
    ["boom", "Internal server error"],
  ] as const)("returns 500 when createTask throws %s", async (rejection, expectedError) => {
    vi.mocked(validateCreateTaskRequest).mockResolvedValue(validated());
    vi.mocked(createTask).mockRejectedValue(rejection);
    const res = await createTaskHandler(
      new NextRequest("http://localhost/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "k" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ status: "error", error: expectedError });
  });
});
