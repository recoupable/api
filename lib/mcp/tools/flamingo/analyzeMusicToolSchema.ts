import { z } from "zod";
import { flamingoGenerateBodySchema } from "@/lib/flamingo/flamingoGenerateBodySchema";

/** Host-provided attachments are normalized to audio_url at the MCP boundary. */
export const analyzeMusicToolSchema = flamingoGenerateBodySchema
  .safeExtend({
    audio_url: flamingoGenerateBodySchema.shape.audio_url.optional(),
    file: z
      .strictObject({
        download_url: z.url({ protocol: /^https$/ }),
        file_id: z.string().min(1).max(2000),
        mime_type: z.string().max(200).optional(),
        file_name: z.string().max(300).optional(),
      })
      .optional()
      .describe("The audio file attached to this conversation, supplied by the host."),
  })
  .refine(data => Boolean(data.file) !== Boolean(data.audio_url), {
    message:
      "Provide one attached audio file or audio_url, not both. Attach your song to continue.",
    path: ["file"],
  });

export type AnalyzeMusicToolInput = z.infer<typeof analyzeMusicToolSchema>;
