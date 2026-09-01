import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateProjectTaskRequest } from "@/lib/projects/validateProjectTaskRequest";
import { deleteProjectTask } from "@/lib/supabase/project_tasks/deleteProjectTask";

/**
 * DELETE /api/projects/{projectId}/tasks/{taskId}
 *
 * Permanently delete a task and, by cascade, its comments. No soft delete.
 * Contract: recoupable/docs#326.
 *
 * @param request - The incoming request.
 * @param projectId - The project the task belongs to.
 * @param taskId - The task to delete.
 * @returns 200 with the deleted id, 401, 404 or 500.
 */
export async function deleteProjectTaskHandler(
  request: NextRequest,
  projectId: string,
  taskId: string,
): Promise<NextResponse> {
  const access = await validateProjectTaskRequest(request, projectId, taskId);
  if (access instanceof NextResponse) return access;

  try {
    const deleted = await deleteProjectTask(projectId, taskId);
    if (!deleted) return errorResponse("Task not found", 404);

    return successResponse({ id: taskId });
  } catch (error) {
    console.error("Error deleting project task:", error);
    return errorResponse("Internal server error", 500);
  }
}
