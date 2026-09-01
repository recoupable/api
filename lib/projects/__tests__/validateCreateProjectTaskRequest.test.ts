import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { validateCreateProjectTaskRequest } from "@/lib/projects/validateCreateProjectTaskRequest";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/projects/requireProjectAccess", () => ({
  requireProjectAccess: vi.fn(),
}));

const url = "https://api.recoupable.dev/api/projects/x/tasks";
const post = (body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

describe("validateCreateProjectTaskRequest", () => {
  it("rejects a malformed projectId with 400 before the body is read", async () => {
    const result = await validateCreateProjectTaskRequest(post({ title: "x" }), "not-a-uuid");

    expect(result).toMatchObject({ status: 400 });
    await expect((result as Response).json()).resolves.toEqual({
      status: "error",
      error: "projectId must be a valid UUID",
    });
  });
});
