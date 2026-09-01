import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { requireUuidParam } from "@/lib/projects/requireUuidParam";
import { requireProjectAccess } from "@/lib/projects/requireProjectAccess";

/**
 * Everything `GET /api/projects/{projectId}/tasks/{taskId}` requires of a
 * request: both path ids are well formed, then the caller is a collaborator on
 * the project.
 *
 * `projectId` is reported before `taskId` when both are malformed, so the
 * message names the segment a reader hits first in the URL.
 *
 * @param request - The incoming request, carrying the Bearer credential.
 * @param projectId - The `projectId` path segment, unvalidated.
 * @param taskId - The `taskId` path segment, unvalidated.
 * @returns The authenticated account id, or the response to return instead.
 */
export async function validateProjectTaskRequest(
  request: NextRequest,
  projectId: string,
  taskId: string,
): Promise<string | NextResponse> {
  const invalidId = requireUuidParam(projectId, "projectId") ?? requireUuidParam(taskId, "taskId");
  if (invalidId) return invalidId;

  return requireProjectAccess(request, projectId);
}
