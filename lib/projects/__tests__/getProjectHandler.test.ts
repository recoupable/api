import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getProjectHandler } from "@/lib/projects/getProjectHandler";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/projects/requireProjectAccess", () => ({
  requireProjectAccess: vi.fn(),
}));

/**
 * A malformed `projectId` must be rejected before anything reaches Postgres.
 * Left unguarded it becomes `invalid input syntax for type uuid`, which the
 * handler's catch turns into a 500 — a plain URL typo answering as a server
 * fault, and not the 400 the contract documents (recoupable/docs#326).
 */
describe("getProjectHandler", () => {
  it("rejects a malformed projectId with 400", async () => {
    const request = new NextRequest("https://api.recoupable.dev/api/projects/not-a-uuid");

    const response = await getProjectHandler(request, "not-a-uuid");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      error: "projectId must be a valid UUID",
    });
  });
});
