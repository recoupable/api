import { z } from "zod";
import { chatAdmissionSchema } from "./chatAdmissionSchema";
const text = z.string().min(1);
const optionalText = text.nullable();
const repositoryUrl = z.url().refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
}, "Repository URL must be HTTPS without credentials, query or fragment");
/** Non-secret intent only; the eventual auth adapter must supply verified identity. */
export const chatCredentialPolicySchema = z
  .object({
    policyVersion: z.literal("chat-credential/v1"),
    credentialIntentId: z.uuid(),
    principal: z.discriminatedUnion("mechanism", [
      z
        .object({
          mechanism: z.literal("privy"),
          accountId: z.uuid(),
          appId: text,
          issuer: text,
          subject: text,
        })
        .strict(),
      z
        .object({ mechanism: z.literal("recoup_api_key"), accountId: z.uuid(), keyId: z.uuid() })
        .strict(),
    ]),
    effectiveAccountId: z.uuid(),
    organizationId: z.uuid().nullable(),
    authorization: z
      .object({ version: text, basis: text, permissions: z.array(text).min(1) })
      .strict(),
    recovery: z.literal("reauthenticate_proven_never_dispatched"),
  })
  .strict();
export const chatExecutionSnapshotSchema = z
  .object({
    contractVersion: z.literal("chat-execution/v1"),
    id: text,
    requestId: z.uuid(),
    effectiveAccountId: z.uuid(),
    chatId: text,
    sessionId: text,
    content: z
      .object({
        options: chatAdmissionSchema.shape.options,
        sessionTitle: z.string().nullable(),
        repoOwner: optionalText,
        repoName: optionalText,
        sandbox: z
          .object({
            workingDirectory: text,
            currentBranch: optionalText,
            state: z
              .object({
                sandboxName: optionalText,
                sandboxId: optionalText,
                snapshotId: optionalText,
                expiresAt: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
                source: z
                  .object({
                    repo: repositoryUrl,
                    branch: optionalText,
                    newBranch: optionalText,
                    prebuilt: z.boolean().nullable(),
                  })
                  .strict()
                  .nullable(),
              })
              .strict(),
          })
          .strict(),
        recoupOrgId: z.uuid().nullable(),
        skills: z
          .array(
            z
              .object({
                name: text,
                description: z.string(),
                path: text,
                filename: text,
                options: z
                  .object({
                    disableModelInvocation: z.boolean().nullable(),
                    userInvocable: z.boolean().nullable(),
                    allowedTools: z.array(text).nullable(),
                    context: z.literal("fork").nullable(),
                    agent: optionalText,
                  })
                  .strict(),
              })
              .strict(),
          )
          .nullable(),
        credentialPolicy: chatCredentialPolicySchema,
      })
      .strict(),
  })
  .strict()
  .refine(s => s.effectiveAccountId === s.content.credentialPolicy.effectiveAccountId);
export type ChatExecutionSnapshot = z.infer<typeof chatExecutionSnapshotSchema>;
