import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { validateCreateSessionBody } from "@/lib/sessions/validateCreateSessionBody";
import { generateSessionBranchName } from "@/lib/sessions/generateSessionBranchName";
import { insertSession } from "@/lib/supabase/sessions/insertSession";
import { deleteSessionById } from "@/lib/supabase/sessions/deleteSessionById";
import { insertChat } from "@/lib/supabase/chats/insertChat";
import { toSessionResponse } from "@/lib/sessions/toSessionResponse";
import { toChatResponse } from "@/lib/sessions/toChatResponse";

/**
 * Handles `POST /api/sessions`.
 *
 * Authenticates the caller, validates the optional request body, then
 * creates a session row and an initial chat row. If the chat insert
 * fails after the session row is persisted, the session is rolled
 * back so callers never observe an orphaned session.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ session, chat }` on 200, or an error.
 */
export async function createSessionHandler(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const body = await safeParseJson(request);
  const validated = validateCreateSessionBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const branch = validated.isNewBranch ? generateSessionBranchName() : (validated.branch ?? null);
  const sessionId = generateUUID();

  const sessionRow = await insertSession({
    id: sessionId,
    account_id: auth.accountId,
    title: validated.title?.trim() || "New session",
    status: "running",
    repo_owner: validated.repoOwner ?? null,
    repo_name: validated.repoName ?? null,
    branch,
    clone_url: validated.cloneUrl ?? null,
    is_new_branch: validated.isNewBranch ?? false,
    global_skill_refs: [],
    sandbox_state: { type: validated.sandboxType ?? "vercel" },
    lifecycle_state: "provisioning",
    lifecycle_version: 0,
  });

  if (!sessionRow) {
    return NextResponse.json(
      { status: "error", error: "Failed to create session" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  const chatRow = await insertChat({
    id: generateUUID(),
    session_id: sessionRow.id,
    title: "New chat",
  });

  if (!chatRow) {
    await deleteSessionById(sessionRow.id);
    return NextResponse.json(
      { status: "error", error: "Failed to create session" },
      { status: 500, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(
    { session: toSessionResponse(sessionRow), chat: toChatResponse(chatRow) },
    { status: 200, headers: getCorsHeaders() },
  );
}
