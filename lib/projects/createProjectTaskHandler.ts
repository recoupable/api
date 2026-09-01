import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateProjectTaskRequest } from "@/lib/projects/validateCreateProjectTaskRequest";
import { insertProjectTask } from "@/lib/supabase/project_tasks/insertProjectTask";

/**
 * POST /api/projects/{projectId}/tasks
 *
 * Create a task. New tasks are always incomplete; completion moves through the
 * PATCH endpoint so the server owns the timestamp and the actor.
 * Contract: recoupable/docs#326.
 *
 * @param request - The incoming request.
 * @param projectId - The project to add the task to.
 * @returns 201 with the created task, 400, 401, 404 or 500.
 */
export async function createProjectTaskHandler(
  request: NextRequest,
  projectId: string,
): Promise<NextResponse> {
  const validated = await validateCreateProjectTaskRequest(request, projectId);
  if (validated instanceof NextResponse) return validated;
  const { body } = validated;

  try {
    const task = await insertProjectTask({
      project_id: projectId,
      title: body.title,
      description: body.description ?? null,
      due_date: body.due_date ?? null,
      assignee_account_id: body.assignee_account_id ?? null,
    });

    return NextResponse.json(
      { status: "success", task },
      { status: 201, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Error creating project task:", error);
    return errorResponse("Internal server error", 500);
  }
}
