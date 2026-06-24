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
 * Handles `POST /api/chat/runs` — the headless, asynchronous counterpart of
 * interactive `/api/chat`. Runs on the durable `runAgentWorkflow`
 * (recoupable/chat#1813): it provisions a session + active sandbox, mints a
 * short-lived account-scoped `recoup_sk_…` key for in-sandbox `recoup-api`
 * calls, builds the shared workflow input via `buildRunAgentInput`, and
 * `start()`s the run — returning `{ runId, chatId, sessionId }` with **202**
 * (plus a `Location` header pointing at the run-status resource) immediately.
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
 * @returns 202 `{ runId, chatId, sessionId }`, or a 4xx/5xx error.
 */
export async function handleStartChatRun(request: NextRequest): Promise<Response> {
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

    // Return the run handle plus the persisted-output identifiers so the caller
    // can read the result later (the workflow runId alone can't be resolved back
    // to the chat): GET /api/chat/{chatId}/stream resumes the stream, and the
    // assistant messages persist under chatId. The Location header points at the
    // run-status resource. Mirrors the async-job shape of POST /api/content/create.
    return NextResponse.json(
      { runId: run.runId, chatId: provisioned.chat.id, sessionId: provisioned.session.id },
      {
        status: 202,
        headers: { ...getCorsHeaders(), Location: `/api/chat/runs/${run.runId}` },
      },
    );
  } catch (error) {
    // The workflow's `finally` revokes the key on run end — but if we never got
    // there (provisioning ok, then mint ok, then start threw), the key would
    // linger until its TTL. Revoke it now. If mint itself threw, there's no key.
    if (ephemeralKeyId) {
      try {
        await deleteApiKey(ephemeralKeyId);
      } catch (cleanupError) {
        console.error("[handleStartChatRun] failed to revoke ephemeral key:", cleanupError);
      }
    }
    console.error("[handleStartChatRun] failed to start generation run:", error);
    return errorResponse("Internal server error", 500);
  }
}
