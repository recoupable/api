import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { requireProjectAccess } from "@/lib/projects/requireProjectAccess";
import { selectProjectTask } from "@/lib/supabase/project_tasks/selectProjectTask";
import { selectProjectTaskComments } from "@/lib/supabase/project_task_comments/selectProjectTaskComments";
import { toProjectComment } from "@/lib/projects/toProjectComment";

/**
 * GET /api/projects/{projectId}/tasks/{taskId}/comments
 *
 * A task's comments, oldest first. Contract: recoupable/docs#326.
 *
 * @param request - The incoming request.
 * @param projectId - The project the task belongs to.
 * @param taskId - The task whose comments to read.
 * @returns 200 with the comments, 401, 404 or 500.
 */
export async function getProjectCommentsHandler(
  request: NextRequest,
  projectId: string,
  taskId: string,
): Promise<NextResponse> {
  const access = await requireProjectAccess(request, projectId);
  if (access instanceof NextResponse) return access;

  try {
    // Confirms the task belongs to this project before reading its comments,
    // so a task id from elsewhere cannot be read through a project the caller
    // does collaborate on.
    const task = await selectProjectTask(projectId, taskId);
    if (!task) return errorResponse("Task not found", 404);

    const comments = await selectProjectTaskComments(taskId);
    return successResponse({ comments: comments.map(toProjectComment) });
  } catch (error) {
    console.error("Error fetching project task comments:", error);
    return errorResponse("Internal server error", 500);
  }
}
