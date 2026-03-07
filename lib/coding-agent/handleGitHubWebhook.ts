import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { verifyGitHubWebhook } from "./verifyGitHubWebhook";
import { getCodingAgentPRState, setCodingAgentPRState } from "./prState";
import { triggerUpdatePR } from "@/lib/trigger/triggerUpdatePR";

const BOT_MENTION = "@recoup-coding-agent";
const SUPPORTED_EVENTS = ["issue_comment", "pull_request_review_comment"];

/**
 * Extracts repo, PR number, branch, and comment body from a GitHub webhook payload.
 * Returns null if the event is not actionable.
 *
 * @param event - The x-github-event header value
 * @param payload - The parsed webhook payload
 */
function extractPRComment(
  event: string,
  payload: Record<string, unknown>,
): { repo: string; prNumber: number; branch: string; commentBody: string } | null {
  if (!SUPPORTED_EVENTS.includes(event)) return null;

  const action = payload.action as string | undefined;
  if (action !== "created") return null;

  const comment = payload.comment as { body?: string } | undefined;
  const commentBody = comment?.body ?? "";
  if (!commentBody.includes(BOT_MENTION)) return null;

  const repository = payload.repository as { full_name: string };
  const repo = repository.full_name;

  if (event === "pull_request_review_comment") {
    const pr = payload.pull_request as { number: number; head: { ref: string } } | undefined;
    if (!pr) return null;
    return { repo, prNumber: pr.number, branch: pr.head.ref, commentBody };
  }

  const issue = payload.issue as { number: number; pull_request?: unknown } | undefined;
  if (!issue?.pull_request) return null;
  return { repo, prNumber: issue.number, branch: "", commentBody };
}

/**
 * Handles incoming GitHub webhook requests for PR comment feedback.
 * Supports both issue_comment and pull_request_review_comment events.
 * Verifies signature, extracts PR context, and triggers update-pr when the bot is mentioned.
 *
 * @param request - The incoming webhook request
 */
export async function handleGitHubWebhook(request: Request): Promise<NextResponse> {
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const event = request.headers.get("x-github-event") ?? "";
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret || !(await verifyGitHubWebhook(body, signature, secret))) {
    return NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401, headers: getCorsHeaders() },
    );
  }

  const payload = JSON.parse(body);
  const extracted = extractPRComment(event, payload);

  if (!extracted) {
    return NextResponse.json({ status: "ignored" }, { headers: getCorsHeaders() });
  }

  let { repo, prNumber, branch, commentBody } = extracted;
  const token = process.env.GITHUB_TOKEN;

  if (!branch) {
    const prResponse = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!prResponse.ok) {
      return NextResponse.json(
        { status: "error", error: "Failed to fetch PR details" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    const prData = await prResponse.json();
    branch = prData.head.ref;
  }

  const prState = await getCodingAgentPRState(repo, branch);

  if (!prState) {
    return NextResponse.json({ status: "no_state" }, { headers: getCorsHeaders() });
  }

  if (prState.status === "running" || prState.status === "updating") {
    return NextResponse.json({ status: "busy" }, { headers: getCorsHeaders() });
  }

  if (prState.status !== "pr_created" || !prState.snapshotId || !prState.prs?.length) {
    return NextResponse.json({ status: "no_state" }, { headers: getCorsHeaders() });
  }

  const feedback = commentBody.replace(BOT_MENTION, "").trim();

  await setCodingAgentPRState(repo, branch, {
    ...prState,
    status: "updating",
  });

  const handle = await triggerUpdatePR({
    feedback,
    snapshotId: prState.snapshotId,
    branch: prState.branch,
    repo: prState.repo,
    callbackThreadId: `github:${repo}:${prNumber}`,
  });

  const [owner, repoName] = repo.split("/");
  await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues/${prNumber}/comments`, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({
      body: `Got your feedback. Updating the PRs...\n\n[View Task](https://chat.recoupable.com/tasks/${handle.id})`,
    }),
  });

  return NextResponse.json({ status: "update_triggered" }, { headers: getCorsHeaders() });
}
