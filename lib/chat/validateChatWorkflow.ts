import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";

export const chatWorkflowBodySchema = z.object({
  messages: z.array(z.any()),
  chatId: z.string().min(1, "chatId is required"),
  sessionId: z.string().min(1, "sessionId is required"),
  context: z
    .object({
      contextLimit: z.number().int("contextLimit must be an integer"),
    })
    .optional(),
  /**
   * Short-lived Privy JWT from the chat UI. Forwarded by the handler
   * into `AgentContext.recoupAccessToken` (Bundle A.4) so the
   * `recoup-api` skill's curl examples can authenticate as the user.
   * Open-agents-shape compatible — their chat UI sends this same
   * field shape.
   */
  recoupAccessToken: z.string().min(1).max(8192).optional(),
  /** Gateway-format model id selected in the chat UI (e.g. `"openai/gpt-5.4-mini"`). */
  model: z.string().min(1).max(256).optional(),
});

export type ChatWorkflowBody = z.infer<typeof chatWorkflowBodySchema>;

export type ChatWorkflowRequest = ChatWorkflowBody & {
  accountId: string;
  orgId: string | null;
  authToken?: string;
};

/**
 * Validates a POST /api/chat/workflow request end-to-end: parses the JSON
 * body, validates it against the schema, and runs auth via
 * validateAuthContext. Returns a NextResponse error short-circuit (400/401/403)
 * or the typed body augmented with the authenticated accountId / orgId / token.
 *
 * @param request - The incoming NextRequest.
 * @returns A NextResponse error or the validated, auth-augmented request.
 */
export async function validateChatWorkflow(
  request: NextRequest,
): Promise<NextResponse | ChatWorkflowRequest> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = chatWorkflowBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return validationErrorResponse(firstError.message, firstError.path);
  }

  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;

  return {
    ...parsed.data,
    accountId: auth.accountId,
    orgId: auth.orgId,
    authToken: auth.authToken,
  };
}
