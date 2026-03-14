import type { GitHubThreadId } from "@chat-adapter/github";

const BOT_MENTION = "@recoup-coding-agent";
const SUPPORTED_EVENTS = ["issue_comment", "pull_request_review_comment"];

export interface PRComment {
  thread: GitHubThreadId;
  branch: string;
  commentBody: string;
}

/**
 * Extracts GitHub thread ID, branch, and comment body from a GitHub webhook payload.
 * Returns null if the event is not actionable.
 *
 * @param event - The x-github-event header value
 * @param payload - The parsed webhook payload
 */
export function extractPRComment(
  event: string,
  payload: Record<string, unknown>,
): PRComment | null {
  if (!SUPPORTED_EVENTS.includes(event)) return null;

  const action = payload.action as string | undefined;
  if (action !== "created") return null;

  const comment = payload.comment as { body?: string; id?: number } | undefined;
  const commentBody = comment?.body ?? "";
  if (!commentBody.includes(BOT_MENTION)) return null;

  const repository = payload.repository as { full_name: string };
  const [owner, repo] = repository.full_name.split("/");

  if (event === "pull_request_review_comment") {
    const pr = payload.pull_request as { number: number; head: { ref: string } } | undefined;
    if (!pr) return null;
    return {
      thread: { owner, repo, prNumber: pr.number, reviewCommentId: comment?.id },
      branch: pr.head.ref,
      commentBody,
    };
  }

  const issue = payload.issue as { number: number; pull_request?: unknown } | undefined;
  if (!issue?.pull_request) return null;
  return {
    thread: { owner, repo, prNumber: issue.number },
    branch: "",
    commentBody,
  };
}
