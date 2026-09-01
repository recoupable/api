import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { validateUpdateProjectTaskRequest } from "@/lib/projects/validateUpdateProjectTaskRequest";
import { toTaskUpdates } from "@/lib/projects/toTaskUpdates";
import { updateProjectTask } from "@/lib/supabase/project_tasks/updateProjectTask";

/**
 * PATCH /api/projects/{projectId}/tasks/{taskId}
 *
 * Update a task, including the completion toggle. Any collaborator may close or
 * reopen any task, the client included; the row records which one did.
 * Contract: recoupable/docs#326.
 *
 * @param request - The incoming request.
 * @param projectId - The project the task belongs to.
 * @param taskId - The task to update.
 * @returns 200 with the updated task, 400, 401, 404 or 500.
 */
export async function updateProjectTaskHandler(
  request: NextRequest,
  projectId: string,
  taskId: string,
): Promise<NextResponse> {
  const validated = await validateUpdateProjectTaskRequest(request, projectId, taskId);
  if (validated instanceof NextResponse) return validated;
  const { accountId, body } = validated;

  try {
    const task = await updateProjectTask(projectId, taskId, toTaskUpdates(body, accountId));
    if (!task) return errorResponse("Task not found", 404);

    return successResponse({ task });
  } catch (error) {
    console.error("Error updating project task:", error);
    return errorResponse("Internal server error", 500);
  }
}
