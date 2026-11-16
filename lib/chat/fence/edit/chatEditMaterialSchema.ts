import { z } from "zod";
import { chatAdmissionSchema } from "../chatAdmissionSchema";
import {
  chatFenceAdmissionCommandSchema,
  chatFenceIdentitySchema,
  fencedTrailingDeleteIntentSchema,
} from "../chatFenceInputSchemas";

const id = z
  .string()
  .min(1)
  .refine(value => Buffer.byteLength(value, "utf8") <= 512);
const canonical = z
  .string()
  .min(1)
  .refine(value => Buffer.byteLength(value, "utf8") <= 1024 * 1024);
const message = chatAdmissionSchema.shape.messages.element.extend({
  id,
  role: z.enum(["user", "assistant"]),
});
export const fencedEditScopeSchema = chatFenceIdentitySchema
  .extend({ chatId: id, sessionId: id, requestId: z.uuid() })
  .strict();
export type FencedEditScope = z.infer<typeof fencedEditScopeSchema>;
export const fencedEditUserIntentSchema = z
  .object({
    anchor_id: id,
    edited_user_message: message.extend({ role: z.literal("user") }),
    // optional() outside the existing defaults preserves omitted requested options.
    requested_options: z
      .object({
        modelId: chatAdmissionSchema.shape.options.shape.modelId.optional(),
        artistId: chatAdmissionSchema.shape.options.shape.artistId.removeDefault().optional(),
        interactive: chatAdmissionSchema.shape.options.shape.interactive.removeDefault().optional(),
        devSurface: chatAdmissionSchema.shape.options.shape.devSurface.removeDefault().optional(),
      })
      .strict(),
  })
  .strict();
export const chatEditMaterialSchema = z
  .object({
    capture: z
      .object({
        deletion: fencedTrailingDeleteIntentSchema.extend({
          expectedEpoch: z
            .number()
            .int()
            .min(0)
            .max(Number.MAX_SAFE_INTEGER - 2),
          chatId: id,
          anchorId: id,
        }),
        turn: z.object({ kind: z.literal("new") }).strict(),
        admission: chatFenceAdmissionCommandSchema.extend({
          payload: chatFenceAdmissionCommandSchema.shape.payload.extend({
            admission_envelope: chatAdmissionSchema.extend({
              messages: z.array(message).max(1000),
            }),
            admission_canonical: canonical,
            execution_canonical: canonical,
          }),
        }),
      })
      .strict(),
    user_intent_canonical: canonical,
    history_witness: z
      .array(z.object({ id, role: z.enum(["user", "assistant"]), message }).strict())
      .max(1000),
  })
  .strict();
export type ChatEditMaterial = z.infer<typeof chatEditMaterialSchema>;
