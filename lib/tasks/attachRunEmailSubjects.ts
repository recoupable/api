import { selectEmailSubjectsByRunIds } from "@/lib/supabase/email_send_log/selectEmailSubjectsByRunIds";
import type { TaskRunWithTitle } from "./attachRunTitles";

export type TaskRunWithNames = TaskRunWithTitle & { email_subject: string | null };

/**
 * Annotates runs with the subject of the email each run sent, resolved via
 * `email_send_log.trigger_run_id` (chat#1958). Runs that sent no linked email
 * get email_subject null — consumers fall back to `title`, then a generic
 * label.
 *
 * Fails open, same stance as attachRunTitles: a lookup failure yields null
 * subjects and the runs list never breaks.
 *
 * @param runs - Runs already annotated with schedule titles.
 * @returns The same runs, each with an email_subject field.
 */
export async function attachRunEmailSubjects(
  runs: TaskRunWithTitle[],
): Promise<TaskRunWithNames[]> {
  if (runs.length === 0) {
    return [];
  }

  try {
    const subjectByRunId = await selectEmailSubjectsByRunIds(runs.map(run => run.id));
    return runs.map(run => ({ ...run, email_subject: subjectByRunId.get(run.id) ?? null }));
  } catch (error) {
    console.error("Error resolving task run email subjects:", error);
    return runs.map(run => ({ ...run, email_subject: null }));
  }
}
