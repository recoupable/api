import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateProjectRequest } from "@/lib/projects/validateProjectRequest";
import {
  validateCreateProjectTaskBody,
  type CreateProjectTaskBody,
} from "@/lib/projects/validateCreateProjectTaskBody";

export interface CreateProjectTaskRequest {
  accountId: string;
  body: CreateProjectTaskBody;
}

/**
 * Everything `POST /api/projects/{projectId}/tasks` requires of a request: a
 * well-formed `projectId`, a caller with a collaborator row on it, and a valid
 * body — in that order, so an unauthorised caller never learns whether their
 * body would have been accepted.
 *
 * @param request - The incoming request, carrying the Bearer credential.
 * @param projectId - The `projectId` path segment, unvalidated.
 * @returns The authenticated account and validated body, or the response to
 *   return instead.
 */
export async function validateCreateProjectTaskRequest(
  request: NextRequest,
  projectId: string,
): Promise<CreateProjectTaskRequest | NextResponse> {
  const access = await validateProjectRequest(request, projectId);
  if (access instanceof NextResponse) return access;

  const body = validateCreateProjectTaskBody(await request.json().catch(() => null));
  if (body instanceof NextResponse) return body;

  return { accountId: access, body };
}
