import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createProjectTaskHandler } from "@/lib/projects/createProjectTaskHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * POST /api/projects/{projectId}/tasks
 *
 * Add a task to a client project (app#2048, contract: recoupable/docs#326).
 *
 * @param request - The incoming request, carrying the Bearer credential.
 * @param root0 - The route context.
 * @param root0.params - The resolved `projectId` path parameter.
 * @returns 201 with the created task; 400 on a bad body; 401 unauthenticated;
 *   404 when the caller is not a collaborator; 500 on a database failure.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const { projectId } = await params;
  return createProjectTaskHandler(request, projectId);
}

export const dynamic = "force-dynamic";
