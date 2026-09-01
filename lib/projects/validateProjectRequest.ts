import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { requireUuidParam } from "@/lib/projects/requireUuidParam";
import { requireProjectAccess } from "@/lib/projects/requireProjectAccess";

/**
 * Everything `GET /api/projects/{projectId}` requires of a request, in the one
 * order it needs: the path id is well formed, then the caller is a
 * collaborator on it.
 *
 * The id is checked first so a malformed segment never reaches Postgres, where
 * it becomes `invalid input syntax for type uuid` and surfaces as a 500.
 *
 * @param request - The incoming request, carrying the Bearer credential.
 * @param projectId - The `projectId` path segment, unvalidated.
 * @returns The authenticated account id, or the response to return instead.
 */
export async function validateProjectRequest(
  request: NextRequest,
  projectId: string,
): Promise<string | NextResponse> {
  const invalidId = requireUuidParam(projectId, "projectId");
  if (invalidId) return invalidId;

  return requireProjectAccess(request, projectId);
}
