import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { validateUpdateProjectTaskRequest } from "@/lib/projects/validateUpdateProjectTaskRequest";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/projects/requireProjectAccess", () => ({
  requireProjectAccess: vi.fn(),
}));

const PROJECT_ID = "60a9a3e7-b7b2-466f-91d3-59b96e875bf6";
const url = "https://api.recoupable.dev/api/projects/x/tasks/y";
const patch = (body: unknown) =>
  new NextRequest(url, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const body = (result: unknown) => (result as Response).json();

describe("validateUpdateProjectTaskRequest", () => {
  it("rejects a malformed projectId with 400", async () => {
    const result = await validateUpdateProjectTaskRequest(
      patch({ title: "x" }),
      "not-a-uuid",
      PROJECT_ID,
    );

    expect(result).toMatchObject({ status: 400 });
    await expect(body(result)).resolves.toEqual({
      status: "error",
      error: "projectId must be a valid UUID",
    });
  });

  it("rejects a malformed taskId with 400 rather than letting it reach Postgres", async () => {
    const result = await validateUpdateProjectTaskRequest(
      patch({ title: "x" }),
      PROJECT_ID,
      "not-a-uuid",
    );

    expect(result).toMatchObject({ status: 400 });
    await expect(body(result)).resolves.toEqual({
      status: "error",
      error: "taskId must be a valid UUID",
    });
  });
});
