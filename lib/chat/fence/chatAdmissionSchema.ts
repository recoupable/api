import { z } from "zod";
import { catalogSurfaceRequestSchema } from "@/lib/intelligent-ui/catalogSurfaceRequest";

/** Server-normalized material only. Never pass the route body or credentials wholesale. */
export const chatAdmissionSchema = z
  .object({
    contractVersion: z.literal("chat-admission/v1"),
    effectiveAccountId: z.uuid(),
    sessionId: z.string().min(1),
    chatId: z.string().min(1),
    expectedEpoch: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    messages: z.array(
      z
        .object({
          id: z.string().min(1),
          role: z.enum(["system", "user", "assistant"]),
          parts: z.array(z.object({ type: z.string().min(1) }).catchall(z.json())),
          metadata: z.json().optional(),
        })
        .strict(),
    ),
    options: z
      .object({
        modelId: z.string().min(1),
        artistId: z.uuid().nullable().default(null),
        interactive: z.boolean().default(true),
        devSurface: catalogSurfaceRequestSchema
          .extend({
            query: catalogSurfaceRequestSchema.shape.query.strict(),
          })
          .nullable()
          .default(null),
      })
      .strict(),
    executionSnapshot: z
      .object({
        id: z.string().min(1),
        digest: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict(),
  })
  .strict();
export type ChatAdmissionEnvelope = z.infer<typeof chatAdmissionSchema>;
