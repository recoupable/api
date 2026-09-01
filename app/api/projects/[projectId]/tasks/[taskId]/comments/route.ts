import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProjectCommentsHandler } from "@/lib/projects/getProjectCommentsHandler";
import { createProjectCommentHandler } from "@/lib/projects/createProjectCommentHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * GET /api/projects/{projectId}/tasks/{taskId}/comments
 *
 * A task's comments, oldest first (app#2048, contract: recoupable/docs#326).
 *
 * @param request - The incoming request, carrying the Bearer credential.
 * @param root0 - The route context.
 * @param root0.params - The resolved `projectId` and `taskId` parameters.
 * @returns 200 with the comments; 401 unauthenticated; 404 when the caller is
 *   not a collaborator or no such task exists; 500 on a database failure.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> },
): Promise<NextResponse> {
  const { projectId, taskId } = await params;
  return getProjectCommentsHandler(request, projectId, taskId);
}

/**
 * POST /api/projects/{projectId}/tasks/{taskId}/comments
 *
 * Post a comment attributed to the caller (app#2048).
 *
 * @param request - The incoming request, carrying the Bearer credential.
 * @param root0 - The route context.
 * @param root0.params - The resolved `projectId` and `taskId` parameters.
 * @returns 201 with the comment; 400 on a bad body; 401 unauthenticated; 404
 *   when the caller is not a collaborator or no such task exists; 500.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> },
): Promise<NextResponse> {
  const { projectId, taskId } = await params;
  return createProjectCommentHandler(request, projectId, taskId);
}

export const dynamic = "force-dynamic";
