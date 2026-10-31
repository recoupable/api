import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { UIMessage } from "ai";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validationErrorResponse } from "@/lib/zod/validationErrorResponse";
import { validateChatRunMessages } from "./validateChatRunMessages";
import { DEFAULT_MODEL } from "@/lib/const";

/**
 * Body schema for `POST /api/chat/runs` (the durable-workflow re-point,
 * recoupable/chat#1813). Exactly one of `prompt` / `messages` must be present.
 * Mirrors `/api/chat`: no session-title / room / tool-exclusion params — this
 * path mints its own session + chat (with a default title) and runs native
 * sandbox tools. The legacy `topic` / `roomId` / `excludeTools` fields are gone.
 */
export const chatRunBodySchema = z.object({
  prompt: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
  artistId: z.string().uuid("artistId must be a valid UUID").optional(),
  accountId: z.string().optional(),
  organizationId: z.string().optional(),
  model: z.string().optional(),
  /** Trigger.dev run id of the scheduled task kicking this run off (chat#2006 item 4a). */
  trigger_run_id: z.string().optional(),
});

export type ChatRunRequest = {
  accountId: string;
  orgId: string | null;
  messages: UIMessage[];
  artistId?: string;
  modelId: string;
  /** Present when a scheduled task started the run; the workflow's ids are written back to it. */
  triggerRunId?: string;
};

/** Validate the SDK message contract and auth before provisioning a durable run. */
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

  const { prompt, messages, artistId, accountId, organizationId, model, trigger_run_id } =
    parsed.data;

  const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : "";
  const hasPrompt = trimmedPrompt.length > 0;
  const hasMessages = Array.isArray(messages) && messages.length > 0;
  if (hasPrompt === hasMessages) {
    return errorResponse("Exactly one of prompt or messages must be provided", 400);
  }

  // Use the same SDK contract as the workflow converter before any session,
  // sandbox, key or workflow can be provisioned. Do not reduce parts to text:
  // file, reasoning, tool and data parts also belong to UIMessage.
  const validatedMessages = await validateChatRunMessages(trimmedPrompt, messages);
  if (!validatedMessages.success) {
    return validationErrorResponse(
      "Invalid messages: expected AI SDK UIMessage objects with id, role and non-empty parts",
      ["messages"],
    );
  }

  const auth = await validateAuthContext(request, {
    accountId,
    organizationId: organizationId ?? null,
  });
  if (auth instanceof NextResponse) return auth;

  // `||` not `??`: an empty/whitespace model must fall back too, or "" would
  // be persisted as provenance and sent to the workflow as the model id.
  const trimmedModel = typeof model === "string" ? model.trim() : "";

  return {
    accountId: auth.accountId,
    orgId: auth.orgId,
    messages: validatedMessages.data,
    artistId,
    modelId: trimmedModel || DEFAULT_MODEL,
    triggerRunId: trigger_run_id,
  };
}
