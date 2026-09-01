import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { validateProjectRequest } from "@/lib/projects/validateProjectRequest";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
// The access check reaches the Privy client, which needs env at module load.
// These cases return before it runs, so it is stubbed rather than exercised.
vi.mock("@/lib/projects/requireProjectAccess", () => ({
  requireProjectAccess: vi.fn(),
}));

const url = "https://api.recoupable.dev/api/projects/not-a-uuid";

/**
 * A malformed `projectId` must be answered before the request reaches auth or
 * Postgres, where it becomes `invalid input syntax for type uuid` and surfaces
 * as a 500 (recoupable/docs#326 documents a 400).
 */
describe("validateProjectRequest", () => {
  it("rejects a malformed projectId with 400", async () => {
    const result = await validateProjectRequest(new NextRequest(url), "not-a-uuid");

    expect(result).toMatchObject({ status: 400 });
    await expect((result as Response).json()).resolves.toEqual({
      status: "error",
      error: "projectId must be a valid UUID",
    });
  });
});
