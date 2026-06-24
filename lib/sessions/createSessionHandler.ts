import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateSessionBody } from "@/lib/sessions/validateCreateSessionBody";
import { resolveSessionTitle } from "@/lib/sessions/resolveSessionTitle";
import {
  createSessionWithInitialChat,
  type CreateSessionWithChatResult,
} from "@/lib/sessions/createSessionWithInitialChat";
import { failedToCreateSession } from "@/lib/sessions/failedToCreateSession";
import { toSessionResponse } from "@/lib/sessions/toSessionResponse";
import { toChatResponse } from "@/lib/sessions/toChatResponse";

const INITIAL_CHAT_TITLE = "New chat";

/**
 * Handles `POST /api/sessions`.
 *
 * Authenticates, validates the request, resolves a final session
 * title (provided > random city fallback), then provisions the workspace
 * repo + session + initial chat via the shared
 * `createSessionWithInitialChat` (also used by the headless
 * `POST /api/chat/runs` path). If the chat insert fails after the session
 * is persisted, the session is rolled back so callers never observe an
 * orphaned session.
 *
 * The clone URL is derived server-side — callers never construct
 * GitHub URLs. Personal sessions (no `organizationId` in body) use
 * `auth.accountId`; org sessions (with `organizationId`) use
 * `auth.orgId` after `validateAuthContext` confirms org access.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ session, chat }` on 200, or an error.
 */
export async function createSessionHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateSessionBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }
  const { body, auth } = validated;

  const title = await resolveSessionTitle({
    providedTitle: body.title,
    accountId: auth.accountId,
  });

  const result: CreateSessionWithChatResult = await createSessionWithInitialChat({
    accountId: auth.accountId,
    workspaceAccountId: auth.orgId ?? auth.accountId,
    title,
    chatTitle: INITIAL_CHAT_TITLE,
    artistId: body.artistId,
  });

  if (result.ok === false) {
    if (result.reason === "repo") {
      return NextResponse.json(
        { status: "error", error: "Failed to provision workspace repository" },
        { status: 502, headers: getCorsHeaders() },
      );
    }
    return failedToCreateSession();
  }

  return NextResponse.json(
    { session: toSessionResponse(result.session), chat: toChatResponse(result.chat) },
    { status: 200, headers: getCorsHeaders() },
  );
}
