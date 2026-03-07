import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCodingAgentCallback } from "./validateCodingAgentCallback";
import { getThread } from "./getThread";
import { handlePRCreated } from "./handlePRCreated";
import { buildPRCard } from "./buildPRCard";
import { setCodingAgentPRState } from "./prState";
import { parseGitHubThreadId } from "./parseGitHubThreadId";
import { postGitHubComment } from "./postGitHubComment";
import type { CodingAgentThreadState } from "./types";

/**
 * Handles coding agent task callback from Trigger.dev.
 * Verifies the shared secret and dispatches based on callback status.
 *
 * @param request - The incoming callback request
 * @returns A NextResponse
 */
export async function handleCodingAgentCallback(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-callback-secret");
  const expectedSecret = process.env.CODING_AGENT_CALLBACK_SECRET;

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401, headers: getCorsHeaders() },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const validated = validateCodingAgentCallback(body);

  if (validated instanceof NextResponse) {
    return validated;
  }

  const github = parseGitHubThreadId(validated.threadId);
  const thread = github ? null : getThread(validated.threadId);

  switch (validated.status) {
    case "pr_created":
      await handlePRCreated(validated.threadId, validated);
      break;

    case "no_changes": {
      const msg = "No changes were detected. The agent didn't modify any files.";
      if (github) {
        await postGitHubComment(github.repo, github.prNumber, msg);
      } else {
        await thread!.setState({ status: "no_changes" });
        await thread!.post(msg);
      }
      break;
    }

    case "failed": {
      const msg = `Agent failed: ${validated.message ?? "Unknown error"}`;
      if (github) {
        await postGitHubComment(github.repo, github.prNumber, msg);
      } else {
        await thread!.setState({ status: "failed" });
        await thread!.post(msg);
      }
      break;
    }

    case "updated": {
      if (github) {
        const prState = await getCodingAgentPRState(github.repo, validated.branch ?? "");
        const prs = prState?.prs ?? [];
        const prLinks = prs.map((pr) => `- [${pr.repo}#${pr.number}](${pr.url})`).join("\n");
        await postGitHubComment(
          github.repo,
          github.prNumber,
          `PRs Updated:\n${prLinks}`,
        );

        if (prState?.branch && prs.length) {
          await setCodingAgentPRState(prs[0].repo, prState.branch, {
            status: "pr_created",
            snapshotId: validated.snapshotId,
            branch: prState.branch,
            repo: prs[0].repo,
            prs,
          });
        }
      } else {
        const state = (await thread!.state) as CodingAgentThreadState | null;
        await thread!.setState({ status: "pr_created", snapshotId: validated.snapshotId });
        const prs = state?.prs ?? [];
        const card = buildPRCard("PRs Updated", prs);
        await thread!.post({ card });

        if (state?.branch && state?.prs?.length) {
          await setCodingAgentPRState(state.prs[0].repo, state.branch, {
            status: "pr_created",
            snapshotId: validated.snapshotId,
            branch: state.branch,
            repo: state.prs[0].repo,
            prs: state.prs,
          });
        }
      }
      break;
    }
  }

  return NextResponse.json({ status: "ok" }, { headers: getCorsHeaders() });
}
