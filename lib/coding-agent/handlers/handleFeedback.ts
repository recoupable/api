import type { Thread } from "chat";
import { buildTaskCard } from "@/lib/agents/buildTaskCard";
import { triggerUpdatePR } from "@/lib/trigger/triggerUpdatePR";
import { setCodingAgentPRState } from "../prState";
import type { CodingAgentThreadState } from "../types";

/**
 * Handle Feedback.
 *
 * @param thread - Value for thread.
 * @param messageText - Value for messageText.
 * @param state - Value for state.
 * @returns - Computed result.
 */
export async function handleFeedback(
  thread: Thread<CodingAgentThreadState>,
  messageText: string,
  state: CodingAgentThreadState | null,
): Promise<boolean> {
  if (state?.status === "running" || state?.status === "updating") {
    await thread.post("I'm still working on this. I'll let you know when I'm done.");
    return true;
  }

  if (state?.status === "pr_created" && state.snapshotId && state.branch && state.prs?.length) {
    await thread.setState({ status: "updating" });
    await setCodingAgentPRState(state.prs[0].repo, state.branch, {
      status: "updating",
      snapshotId: state.snapshotId,
      branch: state.branch,
      repo: state.prs[0].repo,
      prs: state.prs,
    });

    const handle = await triggerUpdatePR({
      feedback: messageText,
      snapshotId: state.snapshotId,
      branch: state.branch,
      repo: state.prs[0].repo,
      callbackThreadId: thread.id,
    });

    const card = buildTaskCard("Updating PRs", "Got your feedback. Updating the PRs...", handle.id);
    await thread.post({ card });
    return true;
  }

  return false;
}
