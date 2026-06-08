import { NextRequest, NextResponse } from "next/server";
import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { start, getRun } from "workflow/api";
import { validateChatWorkflow } from "@/lib/chat/validateChatWorkflow";
import { gateChatStreamStart } from "@/lib/chat/gateChatStreamStart";
import { wrapWorkflowStreamWatcher } from "@/lib/chat/wrapWorkflowStreamWatcher";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { isSandboxActive } from "@/lib/sandbox/isSandboxActive";
import { buildActiveLifecycleUpdate } from "@/lib/sandbox/buildActiveLifecycleUpdate";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import { persistLatestUserMessage } from "@/lib/chat/persistLatestUserMessage";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { runAgentWorkflow } from "@/app/lib/workflows/runAgentWorkflow";
import { extractOrgId } from "@/lib/recoupable/extractOrgId";
import { parseGitHubRepoIdentifiers } from "@/lib/github/parseGitHubRepoIdentifiers";
import { DEFAULT_WORKING_DIRECTORY } from "@/lib/sandbox/vercel/sandbox/constants";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";
import type { VercelState } from "@/lib/sandbox/vercel/state";
import { discoverSkills } from "@/lib/skills/discoverSkills";
import { getSandboxSkillDirectories } from "@/lib/skills/getSandboxSkillDirectories";
import generateUUID from "@/lib/uuid/generateUUID";

const DEFAULT_MODEL_ID = "anthropic/claude-haiku-4.5";

/**
 * Handles POST /api/chat/workflow.
 *
 * Wires the chat UI to a durable Vercel Workflow agent loop. Flow:
 *
 *   1. Validate auth + body (validateChatWorkflow).
 *   2. Verify session + chat ownership; ensure the session has an active sandbox.
 *   3. Gate on any existing run — resume is GET-only (GET /api/chat/[chatId]/stream),
 *      never on POST. A genuinely live run → 409 (reconnect via GET); an
 *      indeterminate probe → 503 (retry the POST shortly); a terminally-done
 *      run's stale id is cleared here so the next POST can start fresh.
 *   4. **Claim `chats.active_stream_id` BEFORE starting the workflow** using
 *      a `pending-<uuid>` placeholder CAS. Closes the race window where two
 *      concurrent requests could both call `start()` and bill the model
 *      before one loses the CAS.
 *   5. Refresh the session's lifecycle-activity timestamp + fire-and-forget
 *      persist the latest user message.
 *   6. start(runAgentWorkflow). Replace the placeholder with the real run id
 *      (we already own the slot, no CAS needed).
 *   7. Return the workflow's UIMessage stream with x-workflow-run-id header.
 *
 * If we lost the placeholder CAS in step 4, the slot is already held by
 * another in-flight or pending request → 409 (no workflow was started, so
 * nothing to cancel).
 *
 * Tools/sandbox passing is intentionally not wired here yet — the follow-up
 * PR ports the @open-harness/agent tool surface into api.
 *
 * @param request - The incoming NextRequest.
 * @returns A streaming 200 Response or a NextResponse error.
 */
export async function handleChatWorkflowStream(request: NextRequest): Promise<Response> {
  const validated = await validateChatWorkflow(request);
  if (validated instanceof NextResponse) return validated;

  // Session + ownership + sandbox active
  const sessions = await selectSessions({ id: validated.sessionId });
  if (sessions === null) return errorResponse("Internal server error", 500);
  const session = sessions[0];
  if (!session) return errorResponse("Session not found", 404);
  if (session.account_id !== validated.accountId) return errorResponse("Forbidden", 403);
  if (!isSandboxActive(session)) return errorResponse("Sandbox not initialized", 400);

  // Chat + ownership
  const chats = await selectChats({ id: validated.chatId });
  if (chats === null) return errorResponse("Internal server error", 500);
  const chat = chats[0];
  if (!chat || chat.session_id !== validated.sessionId) {
    return errorResponse("Chat not found", 404);
  }

  // Resume is GET-only (GET /api/chat/[chatId]/stream); POST never resumes.
  // Gate the start against any existing active stream — resume→409, indeterminate→503,
  // terminal-stale→proceed. See gateChatStreamStart for the full decision table.
  const gate = await gateChatStreamStart(validated.chatId, chat.active_stream_id);
  if (gate) return gate;

  // Pre-claim the active_stream_id slot with a placeholder BEFORE starting
  // the workflow. This closes the race where two requests both call start()
  // and bill the model before one loses the CAS.
  const placeholder = `pending-${generateUUID()}`;
  const claimed = await compareAndSetChatActiveStreamId(validated.chatId, null, placeholder);
  if (!claimed.ok) return errorResponse("Internal server error", 500);
  if (!claimed.claimed) {
    return errorResponse("Another workflow is already running for this chat", 409);
  }

  // We own the slot — safe to start the workflow.
  await updateSession(validated.sessionId, buildActiveLifecycleUpdate(session.sandbox_state));
  void persistLatestUserMessage(validated.chatId, validated.messages as never);

  const modelId = chat.model_id ?? DEFAULT_MODEL_ID;
  const recoupOrgId = session.clone_url
    ? (extractOrgId(session.clone_url) ?? undefined)
    : undefined;

  // Connect the sandbox up-front so we can (a) read the real working
  // directory and (b) discover project-level skills. The connected
  // handle isn't passed into the workflow (it's not durably
  // serializable) — only `sandbox.state` is. Tools reconnect via
  // `connectVercel(state)` inside `"use step"`.
  //
  // If connection fails we fall back to the default working directory
  // so the workflow can still start — tools will surface the
  // underlying failure when they try to reconnect.
  let skills: Awaited<ReturnType<typeof discoverSkills>> = [];
  let workingDirectory: string = DEFAULT_WORKING_DIRECTORY;
  try {
    const sandbox = await connectVercel(session.sandbox_state as VercelState);
    workingDirectory = sandbox.workingDirectory;
    const dirs = await getSandboxSkillDirectories(sandbox);
    skills = await discoverSkills(sandbox, dirs);
  } catch (error) {
    console.error(
      "[handleChatWorkflowStream] sandbox connect / skill discovery failed; continuing with defaults:",
      error,
    );
  }

  // Derive repo identifiers from `session.clone_url` so we have a
  // single source of truth. The `sessions.repo_owner/repo_name`
  // columns exist in the schema but were never populated; treating
  // `clone_url` as canonical avoids a denormalization where the
  // columns could drift from the URL.
  const repoIds = parseGitHubRepoIdentifiers(session.clone_url);

  const run = await start(runAgentWorkflow, [
    {
      messages: validated.messages,
      chatId: validated.chatId,
      sessionId: validated.sessionId,
      accountId: validated.accountId,
      modelId,
      sessionTitle: session.title ?? undefined,
      repoOwner: repoIds?.owner,
      repoName: repoIds?.repo,
      agentContext: {
        sandbox: {
          state: session.sandbox_state as VercelState,
          workingDirectory,
        },
        recoupOrgId,
        skills,
        // Forward the short-lived Privy JWT from the chat UI when
        // present. The `recoup-api` skill's curl examples authenticate
        // against recoup-api with this as a Bearer header (via the
        // `$RECOUP_ACCESS_TOKEN` env var injected by buildRecoupExecEnv).
        // x-api-key auth callers don't send this field — the long-lived
        // recoup_sk_ key is deliberately NOT forwarded (exfiltration
        // risk from model-issued bash).
        ...(validated.recoupAccessToken ? { recoupAccessToken: validated.recoupAccessToken } : {}),
      },
    },
  ]);

  // Promote placeholder → real run id via CAS. If something asynchronously
  // stole the slot (or the DB went down) we cancel the workflow we just
  // started since another stream now owns the client.
  const promoted = await compareAndSetChatActiveStreamId(validated.chatId, placeholder, run.runId);
  if (!promoted.ok || !promoted.claimed) {
    try {
      await getRun(run.runId).cancel();
    } catch (error) {
      console.error("[handleChatWorkflowStream] cancel after slot-loss failed:", error);
    }
    return errorResponse("Another workflow is already running for this chat", 409);
  }

  return createUIMessageStreamResponse({
    stream: wrapWorkflowStreamWatcher(run.runId, run.getReadable<UIMessageChunk>()),
    headers: { ...getCorsHeaders(), "x-workflow-run-id": run.runId },
  });
}
