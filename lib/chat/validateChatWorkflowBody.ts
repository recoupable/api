import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const chatWorkflowBodySchema = z.object({
  messages: z.array(z.any()),
  chatId: z.string().min(1, "chatId is required"),
  sessionId: z.string().min(1, "sessionId is required"),
  context: z
    .object({
      contextLimit: z.number().int("contextLimit must be an integer"),
    })
    .optional(),
});

export type ChatWorkflowBody = z.infer<typeof chatWorkflowBodySchema>;

/**
 * Validates request body for POST /api/chat/workflow.
 *
 * @param body - Parsed JSON body
 * @returns A 400 NextResponse if validation fails, or the typed body if it passes.
 */
export function validateChatWorkflowBody(body: unknown): NextResponse | ChatWorkflowBody {
  const result = chatWorkflowBodySchema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  return result.data;
}
