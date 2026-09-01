import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { validateProjectTaskRequest } from "@/lib/projects/validateProjectTaskRequest";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
// The access check reaches the Privy client, which needs env at module load.
// These cases return before it runs, so it is stubbed rather than exercised.
vi.mock("@/lib/projects/requireProjectAccess", () => ({
  requireProjectAccess: vi.fn(),
}));

const PROJECT_ID = "60a9a3e7-b7b2-466f-91d3-59b96e875bf6";
const TASK_ID = "2906467f-585d-422b-a2c0-a4c64b40ea5b";
const url = "https://api.recoupable.dev/api/projects/x/tasks/y";

const body = (result: unknown) => (result as Response).json();

describe("validateProjectTaskRequest", () => {
  it("rejects a malformed projectId with 400", async () => {
    const result = await validateProjectTaskRequest(new NextRequest(url), "not-a-uuid", TASK_ID);

    expect(result).toMatchObject({ status: 400 });
    await expect(body(result)).resolves.toEqual({
      status: "error",
      error: "projectId must be a valid UUID",
    });
  });

  it("rejects a malformed taskId with 400", async () => {
    const result = await validateProjectTaskRequest(new NextRequest(url), PROJECT_ID, "not-a-uuid");

    expect(result).toMatchObject({ status: 400 });
    await expect(body(result)).resolves.toEqual({
      status: "error",
      error: "taskId must be a valid UUID",
    });
  });

  it("names projectId when both segments are malformed", async () => {
    // Left to right, so the message names the segment a reader hits first.
    const result = await validateProjectTaskRequest(new NextRequest(url), "bad", "alsobad");

    await expect(body(result)).resolves.toEqual({
      status: "error",
      error: "projectId must be a valid UUID",
    });
  });
});
