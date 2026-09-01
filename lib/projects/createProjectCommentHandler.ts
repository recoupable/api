import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateProjectCommentRequest } from "@/lib/projects/validateCreateProjectCommentRequest";
import { selectProjectTask } from "@/lib/supabase/project_tasks/selectProjectTask";
import { insertProjectTaskComment } from "@/lib/supabase/project_task_comments/insertProjectTaskComment";
import { toProjectComment } from "@/lib/projects/toProjectComment";

/**
 * POST /api/projects/{projectId}/tasks/{taskId}/comments
 *
 * Post a comment, attributed to the authenticated account. Append-only: there
 * is no edit and no delete. Contract: recoupable/docs#326.
 *
 * @param request - The incoming request.
 * @param projectId - The project the task belongs to.
 * @param taskId - The task to comment on.
 * @returns 201 with the comment, 400, 401, 404 or 500.
 */
export async function createProjectCommentHandler(
  request: NextRequest,
  projectId: string,
  taskId: string,
): Promise<NextResponse> {
  const validated = await validateCreateProjectCommentRequest(request, projectId, taskId);
  if (validated instanceof NextResponse) return validated;
  const { accountId, body } = validated;

  try {
    const task = await selectProjectTask(projectId, taskId);
    if (!task) return errorResponse("Task not found", 404);

    const comment = await insertProjectTaskComment(taskId, accountId, body.body);

    return NextResponse.json(
      { status: "success", comment: toProjectComment(comment) },
      { status: 201, headers: getCorsHeaders() },
    );
  } catch (error) {
    console.error("Error creating project task comment:", error);
    return errorResponse("Internal server error", 500);
  }
}
