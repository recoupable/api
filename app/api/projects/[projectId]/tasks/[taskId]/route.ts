import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProjectTaskHandler } from "@/lib/projects/getProjectTaskHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * GET /api/projects/{projectId}/tasks/{taskId}
 *
 * One task with its comments (app#2048, contract: recoupable/docs#326).
 *
 * @param request - The incoming request, carrying the Bearer credential.
 * @param root0 - The route context.
 * @param root0.params - The resolved `projectId` and `taskId` parameters.
 * @returns 200 with the task, its comments and the project's collaborators;
 *   401 unauthenticated; 404 when the caller is not a collaborator or no such
 *   task exists on the project; 500 on a database failure.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; taskId: string }> },
): Promise<NextResponse> {
  const { projectId, taskId } = await params;
  return getProjectTaskHandler(request, projectId, taskId);
}

export const dynamic = "force-dynamic";
