import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateProjectTaskRequest } from "@/lib/projects/validateProjectTaskRequest";
import {
  validateCreateProjectCommentBody,
  type CreateProjectCommentBody,
} from "@/lib/projects/validateCreateProjectCommentBody";

export interface CreateProjectCommentRequest {
  accountId: string;
  body: CreateProjectCommentBody;
}

/**
 * Everything `POST /api/projects/{projectId}/tasks/{taskId}/comments` requires:
 * both path ids well formed, a caller with a collaborator row on the project,
 * and a valid body — in that order, so an unauthorised caller never learns
 * whether their body would have been accepted.
 *
 * The id checks are not tidiness: an unguarded `taskId` reaches Postgres as
 * `invalid input syntax for type uuid` and surfaces as a 500 rather than the
 * 400 the contract documents.
 *
 * @param request - The incoming request, carrying the Bearer credential.
 * @param projectId - The `projectId` path segment, unvalidated.
 * @param taskId - The `taskId` path segment, unvalidated.
 * @returns The authenticated account and validated body, or the response to
 *   return instead.
 */
export async function validateCreateProjectCommentRequest(
  request: NextRequest,
  projectId: string,
  taskId: string,
): Promise<CreateProjectCommentRequest | NextResponse> {
  const access = await validateProjectTaskRequest(request, projectId, taskId);
  if (access instanceof NextResponse) return access;

  const body = validateCreateProjectCommentBody(await request.json().catch(() => null));
  if (body instanceof NextResponse) return body;

  return { accountId: access, body };
}
