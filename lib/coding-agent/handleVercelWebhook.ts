import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { verifyVercelWebhook } from "./verifyVercelWebhook";
import { validateVercelDeploymentError } from "./validateVercelDeploymentError";
import { getCodingAgentPRState, setCodingAgentPRState } from "./prState";
import { triggerUpdatePR } from "@/lib/trigger/triggerUpdatePR";

/**
 * Extracts the git branch from Vercel deployment metadata.
 * Vercel populates meta with GitHub commit info when deployed from a branch.
 *
 * @param meta - The deployment metadata record
 * @returns The branch name or null
 */
function extractBranch(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  const branch = meta.githubCommitRef ?? meta.gitlabCommitRef ?? meta.bitbucketCommitRef ?? null;
  return typeof branch === "string" ? branch : null;
}

/**
 * Extracts the repo (owner/name) from Vercel deployment metadata.
 *
 * @param meta - The deployment metadata record
 * @returns The repo string (owner/name) or null
 */
function extractRepo(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  const org = meta.githubCommitOrg ?? meta.gitlabProjectNamespace;
  const repo = meta.githubCommitRepo ?? meta.gitlabProjectName;
  if (typeof org === "string" && typeof repo === "string") {
    return `${org}/${repo}`;
  }
  return null;
}

/**
 * Handles incoming Vercel deployment.error webhook requests.
 * Verifies signature, extracts deployment context, looks up PR state,
 * and triggers the update-pr task with a prompt to use the Vercel CLI
 * to diagnose and fix the build error.
 *
 * @param request - The incoming webhook request
 * @returns A NextResponse
 */
export async function handleVercelWebhook(request: Request): Promise<NextResponse> {
  const body = await request.text();
  const signature = request.headers.get("x-vercel-signature") ?? "";
  const secret = process.env.VERCEL_WEBHOOK_SECRET;

  if (!secret || !verifyVercelWebhook(body, signature, secret)) {
    return NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401, headers: getCorsHeaders() },
    );
  }

  const payload = JSON.parse(body);

  if (payload.type !== "deployment.error") {
    return NextResponse.json({ status: "ignored" }, { headers: getCorsHeaders() });
  }

  const validated = validateVercelDeploymentError(payload);

  if (validated instanceof NextResponse) {
    return validated;
  }

  const { deployment, project } = validated.payload;
  const meta = deployment.meta as Record<string, unknown> | undefined;
  const branch = extractBranch(meta);
  const repo = extractRepo(meta);

  if (!branch || !repo) {
    console.warn("[vercel-webhook] Could not extract branch/repo from deployment metadata:", {
      deploymentId: deployment.id,
      meta,
    });
    return NextResponse.json(
      { status: "skipped", reason: "missing branch or repo in deployment metadata" },
      { headers: getCorsHeaders() },
    );
  }

  const prState = await getCodingAgentPRState(repo, branch);

  if (!prState) {
    return NextResponse.json(
      { status: "skipped", reason: "no PR state found for branch" },
      { headers: getCorsHeaders() },
    );
  }

  if (prState.status === "running" || prState.status === "updating") {
    return NextResponse.json({ status: "busy" }, { headers: getCorsHeaders() });
  }

  if (prState.status !== "pr_created" || !prState.snapshotId || !prState.prs?.length) {
    return NextResponse.json(
      { status: "skipped", reason: "PR state not eligible for update" },
      { headers: getCorsHeaders() },
    );
  }

  await setCodingAgentPRState(repo, branch, {
    ...prState,
    status: "updating",
  });

  const deploymentUrl = deployment.url;
  const feedback = [
    "The Vercel deployment failed for this branch.",
    `Deployment URL: ${deploymentUrl}`,
    `Project: ${deployment.name} (${project.id})`,
    "",
    "Use the Vercel CLI to inspect the build logs and diagnose the error:",
    `  vercel inspect ${deploymentUrl} --logs`,
    "",
    "Read the build error output, identify the root cause, and fix the code.",
    "After fixing, commit and push the changes to this branch.",
  ].join("\n");

  const callbackThreadId = prState.prs[0]
    ? `github:${repo}:${prState.prs[0].number}`
    : `vercel:${deployment.id}`;

  try {
    await triggerUpdatePR({
      feedback,
      snapshotId: prState.snapshotId,
      branch: prState.branch,
      repo: prState.repo,
      callbackThreadId,
    });

    return NextResponse.json(
      { status: "update_triggered", deploymentId: deployment.id },
      { headers: getCorsHeaders() },
    );
  } catch (error) {
    await setCodingAgentPRState(repo, branch, prState);
    console.error("[vercel-webhook] Failed to trigger update-pr:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to trigger update" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
