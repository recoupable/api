import { z } from "zod";
import { internalWorkflowFenceSchema } from "@/app/lib/workflows/fence/TrustedFencedWorkflowInput";
import { ProjectionEvidenceError } from "./ProjectionEvidenceError";
const id = z.string().min(1);
const inputSchema = z
  .object({
    accountId: id,
    chatId: id,
    sessionId: id,
    messages: z.array(z.unknown()),
    modelId: id,
    agentContext: z.record(z.string(), z.unknown()),
    devCatalogSurface: z.unknown().optional(),
    artistId: id.optional(),
    reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
    interactive: z.boolean().optional(),
    sessionTitle: z.string().optional(),
    repoOwner: z.string().optional(),
    repoName: z.string().optional(),
  })
  .strict();
const argsSchema = z.tuple([
  z.union([
    inputSchema,
    z
      .object({
        kind: z.literal("internal-fenced/v1"),
        input: inputSchema,
        fence: internalWorkflowFenceSchema,
      })
      .strict(),
  ]),
]);
/** Parse only the actual invocation shapes; a matching nested object is never authority. */
export function parseProjectionRunAuthority(input: unknown) {
  const result = argsSchema.safeParse(input);
  if (!result.success) throw new ProjectionEvidenceError("invalid_evidence");
  const invocation = result.data[0];
  if (!("kind" in invocation)) return invocation;
  const { authority } = invocation.fence;
  if (
    authority.chatId !== invocation.input.chatId ||
    authority.effectiveAccount !== invocation.input.accountId
  )
    throw new ProjectionEvidenceError("authority_mismatch");
  return invocation.input;
}
