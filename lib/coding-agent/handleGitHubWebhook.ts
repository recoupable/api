import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { verifyGitHubWebhook } from "./verifyGitHubWebhook";
import { encodeGitHubThreadId } from "./encodeGitHubThreadId";
import { extractPRComment } from "./extractPRComment";
import { getCodingAgentPRState, setCodingAgentPRState } from "./prState";
import { triggerUpdatePR } from "@/lib/trigger/triggerUpdatePR";
import { postGitHubComment } from "./postGitHubComment";

const BOT_MENTION = "@recoup-coding-agent";

/**
 * Handle Git Hub Webhook.
 *
 * @param request - Parameter.
 * @returns - Result.
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

  let { thread, branch, commentBody } = extracted;
  const fullRepo = `${thread.owner}/${thread.repo}`;
  const token = process.env.GITHUB_TOKEN;

  if (!branch) {
    const prResponse = await fetch(
      `https://api.github.com/repos/${fullRepo}/pulls/${thread.prNumber}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!prResponse.ok) {
      return NextResponse.json(
        { status: "error", error: "Failed to fetch PR details" },
        { status: 500, headers: getCorsHeaders() },
      );
    }

    const prData = await prResponse.json();
    branch = prData.head.ref;
  }

  const prState = await getCodingAgentPRState(fullRepo, branch);

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

  await setCodingAgentPRState(fullRepo, branch, {
    ...prState,
    status: "updating",
  });

  const threadId = encodeGitHubThreadId(thread);

  try {
    const handle = await triggerUpdatePR({
      feedback,
      snapshotId: prState.snapshotId,
      branch: prState.branch,
      repo: prState.repo,
      callbackThreadId: threadId,
    });

    await postGitHubComment(
      fullRepo,
      thread.prNumber,
      `Got your feedback. Updating the PRs...\n\n[View Task](https://chat.recoupable.com/tasks/${handle.id})`,
    );

    return NextResponse.json({ status: "update_triggered" }, { headers: getCorsHeaders() });
  } catch (error) {
    await setCodingAgentPRState(fullRepo, branch, prState);
    console.error("Failed to trigger update-pr:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to trigger update" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
