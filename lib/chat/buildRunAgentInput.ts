import type { UIMessage } from "ai";
import type { RunAgentWorkflowInput } from "@/app/lib/workflows/runAgentWorkflow";
import type { DurableAgentContext } from "@/lib/agent/tools/AgentContext";
import type { VercelState } from "@/lib/sandbox/vercel/state";
import { parseGitHubRepoIdentifiers } from "@/lib/github/parseGitHubRepoIdentifiers";
import { extractOrgId } from "@/lib/recoupable/extractOrgId";

export type BuildRunAgentInputParams = {
  messages: UIMessage[];
  chatId: string;
  sessionId: string;
  accountId: string;
  modelId: string;
  sessionTitle?: string;
  /** `session.clone_url` — the single source for repo ids + recoup org id. */
  cloneUrl: string | null;
  sandboxState: VercelState;
  workingDirectory: string;
  skills: DurableAgentContext["skills"];
  /**
   * Short-lived bearer for in-sandbox recoup-api calls: the user's Privy JWT
   * (interactive `/api/chat/workflow`) or an ephemeral account key (headless
   * `/api/chat/runs`). Omitted when absent so the service key never leaks.
   */
  recoupAccessToken?: string;
  /**
   * Row id of an ephemeral key minted for a headless run, so the workflow can
   * delete it on run end (recoupable/chat#1813). Interactive callers omit it.
   */
  ephemeralKeyId?: string;
};

/**
 * Build the durable `RunAgentWorkflowInput` shared by the interactive and
 * headless callers, so both construct workflow input identically
 * (recoupable/chat#1813). Repo identifiers and the recoup org id are both
 * derived from `cloneUrl` here — one source of truth, no caller duplication.
 */
export function buildRunAgentInput({
  messages,
  chatId,
  sessionId,
  accountId,
  modelId,
  sessionTitle,
  cloneUrl,
  sandboxState,
  workingDirectory,
  skills,
  recoupAccessToken,
  ephemeralKeyId,
}: BuildRunAgentInputParams): RunAgentWorkflowInput {
  const repoIds = parseGitHubRepoIdentifiers(cloneUrl);
  const recoupOrgId = cloneUrl ? (extractOrgId(cloneUrl) ?? undefined) : undefined;

  return {
    messages,
    chatId,
    sessionId,
    accountId,
    modelId,
    sessionTitle,
    repoOwner: repoIds?.owner,
    repoName: repoIds?.repo,
    agentContext: {
      sandbox: { state: sandboxState, workingDirectory },
      recoupOrgId,
      skills,
      ...(recoupAccessToken ? { recoupAccessToken } : {}),
      ...(ephemeralKeyId ? { ephemeralKeyId } : {}),
    },
  };
}
