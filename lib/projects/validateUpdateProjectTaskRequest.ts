import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateProjectTaskRequest } from "@/lib/projects/validateProjectTaskRequest";
import {
  validateUpdateProjectTaskBody,
  type UpdateProjectTaskBody,
} from "@/lib/projects/validateUpdateProjectTaskBody";

export interface UpdateProjectTaskRequest {
  accountId: string;
  body: UpdateProjectTaskBody;
}

/**
 * Everything `PATCH /api/projects/{projectId}/tasks/{taskId}` requires: both
 * path ids well formed, a caller with a collaborator row on the project, and a
 * valid body — in that order.
 *
 * The id checks matter beyond tidiness: an unguarded `taskId` reaches Postgres
 * as `invalid input syntax for type uuid` and surfaces as a 500 rather than the
 * 400 the contract documents.
 *
 * @param request - The incoming request, carrying the Bearer credential.
 * @param projectId - The `projectId` path segment, unvalidated.
 * @param taskId - The `taskId` path segment, unvalidated.
 * @returns The authenticated account and validated body, or the response to
 *   return instead.
 */
export async function validateUpdateProjectTaskRequest(
  request: NextRequest,
  projectId: string,
  taskId: string,
): Promise<UpdateProjectTaskRequest | NextResponse> {
  const access = await validateProjectTaskRequest(request, projectId, taskId);
  if (access instanceof NextResponse) return access;

  const body = validateUpdateProjectTaskBody(await request.json().catch(() => null));
  if (body instanceof NextResponse) return body;

  return { accountId: access, body };
}
