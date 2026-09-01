import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getProjectTaskHandler } from "@/lib/projects/getProjectTaskHandler";

const PROJECT_ID = "60a9a3e7-b7b2-466f-91d3-59b96e875bf6";
const url = "https://api.recoupable.dev/api/projects/x/tasks/y";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/projects/requireProjectAccess", () => ({
  requireProjectAccess: vi.fn(),
}));

/**
 * Both path segments are UUID columns, so both need the same guard. `taskId`
 * is the one a client can mistype from a link, and unguarded it 500s.
 */
describe("getProjectTaskHandler", () => {
  it("rejects a malformed projectId with 400", async () => {
    const response = await getProjectTaskHandler(new NextRequest(url), "not-a-uuid", PROJECT_ID);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      error: "projectId must be a valid UUID",
    });
  });

  it("rejects a malformed taskId with 400", async () => {
    const response = await getProjectTaskHandler(new NextRequest(url), PROJECT_ID, "not-a-uuid");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      error: "taskId must be a valid UUID",
    });
  });
});
