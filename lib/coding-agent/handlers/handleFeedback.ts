import { buildTaskCard } from "../buildTaskCard";
import { triggerUpdatePR } from "@/lib/trigger/triggerUpdatePR";
import type { CodingAgentThreadState } from "../types";

/**
 * Handles a message in a thread that already has state.
 * Returns true if the message was handled (busy or feedback), false otherwise.
 *
 * @param thread - The chat thread
 * @param messageText - The user's message text
 * @param state - The current thread state
 */
export async function handleFeedback(
  thread: { id: string; post: (msg: unknown) => Promise<void>; setState: (s: Partial<CodingAgentThreadState>) => Promise<void> },
  messageText: string,
  state: CodingAgentThreadState | null,
): Promise<boolean> {
  if (state?.status === "running" || state?.status === "updating") {
    await thread.post("I'm still working on this. I'll let you know when I'm done.");
    return true;
  }

  if (state?.status === "pr_created" && state.snapshotId && state.branch && state.prs?.length) {
    await thread.setState({ status: "updating" });
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
