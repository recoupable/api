import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { UIMessage } from "ai";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";
import { generateUUID } from "@/lib/uuid/generateUUID";

/** Default model for headless generation when the caller omits `model`. */
export const DEFAULT_RUN_MODEL_ID = "anthropic/claude-haiku-4.5";

/**
 * Body schema for `POST /api/chat/runs` (the durable-workflow re-point,
 * recoupable/chat#1813). Exactly one of `prompt` / `messages` must be present.
 * Mirrors `/api/chat`: no session-title / room / tool-exclusion params — this
 * path mints its own session + chat (with a default title) and runs native
 * sandbox tools. The legacy `topic` / `roomId` / `excludeTools` fields are gone.
 */
export const chatRunBodySchema = z.object({
  prompt: z.string().optional(),
  messages: z.array(z.any()).optional(),
  artistId: z.string().uuid("artistId must be a valid UUID").optional(),
  accountId: z.string().optional(),
  organizationId: z.string().optional(),
  model: z.string().optional(),
});

export type ChatRunRequest = {
  accountId: string;
  orgId: string | null;
  messages: UIMessage[];
  artistId?: string;
  modelId: string;
};

/**
 * Validates a `POST /api/chat/runs` request end-to-end: parses + validates
 * the body, runs auth via `validateAuthContext` (x-api-key, with org-key
 * account override), and normalizes `prompt`/`messages` into a `UIMessage[]`.
 *
 * @param request - The incoming NextRequest.
 * @returns A NextResponse error short-circuit (400/401/403) or the validated,
 *   auth-augmented request ready to provision + start a workflow run.
 */
export async function validateChatRunRequest(
  request: NextRequest,
): Promise<NextResponse | ChatRunRequest> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = chatRunBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return validationErrorResponse(firstError.message, firstError.path);
  }

  const { prompt, messages, artistId, accountId, organizationId, model } = parsed.data;

  const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : "";
  const hasPrompt = trimmedPrompt.length > 0;
  const hasMessages = Array.isArray(messages) && messages.length > 0;
  if (hasPrompt === hasMessages) {
    return errorResponse("Exactly one of prompt or messages must be provided", 400);
  }

  const auth = await validateAuthContext(request, {
    accountId,
    organizationId: organizationId ?? null,
  });
  if (auth instanceof NextResponse) return auth;

  const uiMessages: UIMessage[] = hasPrompt
    ? [{ id: generateUUID(), role: "user", parts: [{ type: "text", text: trimmedPrompt }] }]
    : (messages as UIMessage[]);

  return {
    accountId: auth.accountId,
    orgId: auth.orgId,
    messages: uiMessages,
    artistId,
    modelId: model ?? DEFAULT_RUN_MODEL_ID,
  };
}
