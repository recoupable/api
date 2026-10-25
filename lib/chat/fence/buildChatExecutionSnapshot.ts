import { createHash } from "node:crypto";
import type { RunAgentWorkflowInput } from "@/app/lib/workflows/runAgentWorkflow";
import { chatExecutionSnapshotSchema } from "./chatExecutionSnapshotSchema";
import { encodeStrictJson } from "./encodeStrictJson";

/** Server-only projection of resolved workflow inputs. Never takes a route body or authenticates. */
export function buildChatExecutionSnapshot({
  id,
  requestId,
  workflowInput: input,
  credentialPolicy,
}: {
  id: string;
  requestId: string;
  workflowInput: RunAgentWorkflowInput;
  credentialPolicy: unknown;
}) {
  const { sandbox, skills, recoupOrgId } = input.agentContext;
  const { state } = sandbox;
  const source = state.source;
  const material = {
    contractVersion: "chat-execution/v1",
    id,
    requestId,
    effectiveAccountId: input.accountId,
    chatId: input.chatId,
    sessionId: input.sessionId,
    content: {
      options: {
        modelId: input.modelId,
        artistId: input.artistId ?? null,
        interactive: input.interactive ?? true,
        devSurface: input.devCatalogSurface ?? null,
      },
      sessionTitle: input.sessionTitle ?? null,
      repoOwner: input.repoOwner ?? null,
      repoName: input.repoName ?? null,
      sandbox: {
        workingDirectory: sandbox.workingDirectory,
        currentBranch: sandbox.currentBranch ?? null,
        state: {
          sandboxName: state.sandboxName ?? null,
          sandboxId: state.sandboxId ?? null,
          snapshotId: state.snapshotId ?? null,
          expiresAt: state.expiresAt ?? null,
          source: source
            ? {
                repo: source.repo,
                branch: source.branch ?? null,
                newBranch: source.newBranch ?? null,
                prebuilt: source.prebuilt ?? null,
              }
            : null,
        },
      },
      recoupOrgId: recoupOrgId ?? null,
      skills:
        skills?.map(skill => ({
          name: skill.name,
          description: skill.description,
          path: skill.path,
          filename: skill.filename,
          options: {
            disableModelInvocation: skill.options.disableModelInvocation ?? null,
            userInvocable: skill.options.userInvocable ?? null,
            allowedTools: skill.options.allowedTools ?? null,
            context: skill.options.context ?? null,
            agent: skill.options.agent ?? null,
          },
        })) ?? null,
      credentialPolicy,
    },
  };
  encodeStrictJson(material);
  const snapshot = chatExecutionSnapshotSchema.parse(material);
  const canonical = encodeStrictJson(snapshot);
  return {
    snapshot,
    canonical,
    digest: createHash("sha256").update(canonical, "utf8").digest("hex"),
  };
}
