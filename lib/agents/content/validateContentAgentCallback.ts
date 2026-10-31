import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { z } from "zod";

const contentRunResultSchema = z.object({
  runId: z.string(),
  status: z.enum(["completed", "failed", "timeout"]),
  videoUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  captionText: z.string().optional(),
  error: z.string().optional(),
});

export const contentAgentCallbackSchema = z.object({
  threadId: z
    .string({ message: "threadId is required" })
    .min(1, "threadId cannot be empty")
    .regex(/^[^:]+:[^:]+:[^:]+$/, "threadId must match adapter:channel:thread format"),
  status: z.enum(["completed", "failed", "timeout"]),
  results: z.array(contentRunResultSchema).optional(),
  message: z.string().optional(),
});

export type ContentAgentCallbackBody = z.infer<typeof contentAgentCallbackSchema>;

/**
 * Validates the content agent callback body against the expected schema.
 *
 * @param body - The parsed JSON body of the callback request.
 * @returns A NextResponse with an error if validation fails, or the validated body.
 */
export function validateContentAgentCallback(
  body: unknown,
): NextResponse | ContentAgentCallbackBody {
  const result = contentAgentCallbackSchema.safeParse(body);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return errorResponse(firstError.message, 400, { missing_fields: firstError.path });
  }

  return result.data;
}
