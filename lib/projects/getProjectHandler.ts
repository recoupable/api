import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { requireProjectAccess } from "@/lib/projects/requireProjectAccess";
import { selectProject } from "@/lib/supabase/projects/selectProject";
import { selectProjectTasks } from "@/lib/supabase/project_tasks/selectProjectTasks";
import { selectProjectCollaborators } from "@/lib/supabase/project_collaborators/selectProjectCollaborators";
import { countProjectTaskComments } from "@/lib/supabase/project_task_comments/countProjectTaskComments";
import { toProjectTask } from "@/lib/projects/toProjectTask";
import { toProjectCollaborator } from "@/lib/projects/toProjectCollaborator";

/**
 * GET /api/projects/{projectId}
 *
 * The project, every task on it oldest first, and its collaborators.
 * Contract: recoupable/docs#326.
 */
export async function getProjectHandler(
  request: NextRequest,
  projectId: string,
): Promise<NextResponse> {
  // Mirrors getMusicGenerationHandler: a malformed path parameter is answered
  // before auth or the database. Unguarded it reaches Postgres as `invalid
  // input syntax for type uuid`, and the catch below turns a URL typo into a
  // 500. A 400 discloses nothing — it says the id is not an id, not whether
  // any project by that id exists.
  if (!z.string().uuid().safeParse(projectId).success) {
    return errorResponse("projectId must be a valid UUID", 400);
  }

  const access = await requireProjectAccess(request, projectId);
  if (access instanceof NextResponse) return access;

  try {
    const project = await selectProject(projectId);
    // A collaborator row without its project is a broken invariant, but it
    // still answers 404 rather than 500: the caller cannot act on either.
    if (!project) return errorResponse("Project not found", 404);

    const [tasks, collaborators] = await Promise.all([
      selectProjectTasks(projectId),
      selectProjectCollaborators(projectId),
    ]);
    const commentCounts = await countProjectTaskComments(tasks.map(t => t.id));

    return successResponse({
      project,
      tasks: tasks.map(task => toProjectTask(task, commentCounts)),
      collaborators: collaborators.map(toProjectCollaborator),
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return errorResponse("Internal server error", 500);
  }
}
