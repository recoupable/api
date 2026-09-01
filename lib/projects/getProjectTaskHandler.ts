import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { requireProjectAccess } from "@/lib/projects/requireProjectAccess";
import { requireUuidParam } from "@/lib/projects/requireUuidParam";
import { selectProjectTask } from "@/lib/supabase/project_tasks/selectProjectTask";
import { selectProjectTaskComments } from "@/lib/supabase/project_task_comments/selectProjectTaskComments";
import { selectProjectCollaborators } from "@/lib/supabase/project_collaborators/selectProjectCollaborators";
import { toProjectComment } from "@/lib/projects/toProjectComment";
import { toProjectCollaborator } from "@/lib/projects/toProjectCollaborator";

/**
 * GET /api/projects/{projectId}/tasks/{taskId}
 *
 * One task with its comment feed and the project's collaborators.
 * Contract: recoupable/docs#326.
 */
export async function getProjectTaskHandler(
  request: NextRequest,
  projectId: string,
  taskId: string,
): Promise<NextResponse> {
  // Both segments are UUID columns, so both get the guard. `taskId` is the one
  // a client can mistype out of a link.
  const invalidId = requireUuidParam(projectId, "projectId") ?? requireUuidParam(taskId, "taskId");
  if (invalidId) return invalidId;

  const access = await requireProjectAccess(request, projectId);
  if (access instanceof NextResponse) return access;

  try {
    const task = await selectProjectTask(projectId, taskId);
    if (!task) return errorResponse("Task not found", 404);

    const [comments, collaborators] = await Promise.all([
      selectProjectTaskComments(taskId),
      selectProjectCollaborators(projectId),
    ]);

    return successResponse({
      task,
      comments: comments.map(toProjectComment),
      collaborators: collaborators.map(toProjectCollaborator),
    });
  } catch (error) {
    console.error("Error fetching project task:", error);
    return errorResponse("Internal server error", 500);
  }
}
