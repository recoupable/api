import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { validateGenerateRequest } from "@/lib/chat/generate/validateGenerateRequest";
import { provisionGenerateSession } from "@/lib/chat/generate/provisionGenerateSession";
import { mintEphemeralAccountKey } from "@/lib/keys/mintEphemeralAccountKey";
import { deleteApiKey } from "@/lib/supabase/account_api_keys/deleteApiKey";
import { buildRunAgentInput } from "@/lib/chat/buildRunAgentInput";
import { runAgentWorkflow } from "@/app/lib/workflows/runAgentWorkflow";

/**
 * Handles `POST /api/chat/generate` — the headless, asynchronous counterpart of
 * interactive `/api/chat`. Re-pointed onto the durable `runAgentWorkflow`
 * (recoupable/chat#1813): it provisions a session + active sandbox, mints a
 * short-lived account-scoped `recoup_sk_…` key for in-sandbox `recoup-api`
 * calls, builds the shared workflow input via `buildRunAgentInput`, and
 * `start()`s the run — returning `{ runId }` with **202** immediately.
 *
 * Generation, assistant-message persistence, the credit charge, and the
 * ephemeral-key revocation all happen server-side inside the workflow after
 * this response. The legacy synchronous `ToolLoopAgent` path is gone.
 *
 * The minted key is injected as the agent's `recoupAccessToken` (so the service
 * key never enters model-issued bash) and threaded as `ephemeralKeyId` so the
 * workflow deletes it on run end; its ~15m TTL is the backstop. If the run
 * fails to start, we revoke the key here since the workflow never ran.
 *
 * @param request - The incoming request (x-api-key auth).
 * @returns 202 `{ runId }`, or a 4xx/5xx error.
 */
export async function handleChatGenerate(request: NextRequest): Promise<Response> {
  const validated = await validateGenerateRequest(request);
  if (validated instanceof NextResponse) return validated;

  const { accountId, messages, artistId, modelId, sessionTitle } = validated;

  let ephemeralKeyId: string | undefined;
  try {
    const provisioned = await provisionGenerateSession({
      accountId,
      title: sessionTitle ?? "Scheduled generation",
      artistId,
    });

    const { rawKey, keyId } = await mintEphemeralAccountKey(accountId);
    ephemeralKeyId = keyId;

    const run = await start(runAgentWorkflow, [
      buildRunAgentInput({
        messages,
        chatId: provisioned.chat.id,
        sessionId: provisioned.session.id,
        accountId,
        modelId,
        sessionTitle: provisioned.session.title ?? sessionTitle,
        cloneUrl: provisioned.session.clone_url,
        sandboxState: provisioned.sandboxState,
        workingDirectory: provisioned.workingDirectory,
        skills: provisioned.skills,
        recoupAccessToken: rawKey,
        ephemeralKeyId: keyId,
      }),
    ]);

    return NextResponse.json({ runId: run.runId }, { status: 202, headers: getCorsHeaders() });
  } catch (error) {
    // The workflow's `finally` revokes the key on run end — but if we never got
    // there (provisioning ok, then mint ok, then start threw), the key would
    // linger until its TTL. Revoke it now. If mint itself threw, there's no key.
    if (ephemeralKeyId) {
      try {
        await deleteApiKey(ephemeralKeyId);
      } catch (cleanupError) {
        console.error("[handleChatGenerate] failed to revoke ephemeral key:", cleanupError);
      }
    }
    console.error("[handleChatGenerate] failed to start generation run:", error);
    return errorResponse("Failed to start chat generation", 500);
  }
}
