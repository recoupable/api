import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProjectHandler } from "@/lib/projects/getProjectHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * GET /api/projects/{projectId}
 *
 * A client project with its tasks and collaborators (app#2048, contract:
 * recoupable/docs#326). Access is a `project_collaborators` row; a caller
 * without one gets 404, never 403.
 *
 * @param request - The incoming request, carrying the Bearer credential.
 * @param root0 - The route context.
 * @param root0.params - The resolved `projectId` path parameter.
 * @returns 200 with the project, its tasks and its collaborators; 401
 *   unauthenticated; 404 when the caller is not a collaborator on it or no such
 *   project exists; 500 on a database failure.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const { projectId } = await params;
  return getProjectHandler(request, projectId);
}

export const dynamic = "force-dynamic";
