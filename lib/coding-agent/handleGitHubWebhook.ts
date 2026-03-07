import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { verifyGitHubWebhook } from "./verifyGitHubWebhook";
import { getCodingAgentPRState, setCodingAgentPRState } from "./prState";
import { triggerUpdatePR } from "@/lib/trigger/triggerUpdatePR";

const BOT_MENTION = "@recoup-coding-agent";

/**
 * Handles incoming GitHub webhook requests for PR comment feedback.
 * Verifies signature, parses issue_comment events on PRs,
 * and triggers update-pr when the bot is mentioned.
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

  if (event !== "issue_comment" || payload.action !== "created" || !payload.issue?.pull_request) {
    return NextResponse.json({ status: "ignored" }, { headers: getCorsHeaders() });
  }

  const commentBody: string = payload.comment?.body ?? "";
  if (!commentBody.includes(BOT_MENTION)) {
    return NextResponse.json({ status: "ignored" }, { headers: getCorsHeaders() });
  }

  const repo: string = payload.repository.full_name;
  const prNumber: number = payload.issue.number;
  const token = process.env.GITHUB_TOKEN;

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
  const branch: string = prData.head.ref;

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
