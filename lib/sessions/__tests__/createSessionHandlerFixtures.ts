import { NextRequest } from "next/server";
import type { Tables } from "@/types/database.types";

export type SessionRow = Tables<"sessions">;
export type ChatRow = Tables<"chats">;

/**
 * Builds a NextRequest pointing at `/api/sessions` with a JSON body.
 *
 * @param body - The body to send (object literal or raw string).
 */
export function makeCreateSessionReq(body: unknown): NextRequest {
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-api-key": "key_test",
  });
  return new NextRequest("http://localhost/api/sessions", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/**
 * A minimal valid `sessions` row that tests can override per case.
 */
export function baseSessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "sess_1",
    account_id: "acc-uuid-1",
    title: "Test session",
    status: "running",
    repo_owner: null,
    repo_name: null,
    branch: null,
    clone_url: null,
    is_new_branch: false,
    global_skill_refs: [],
    sandbox_state: { type: "vercel" },
    lifecycle_state: "provisioning",
    lifecycle_version: 0,
    last_activity_at: null,
    sandbox_expires_at: null,
    hibernate_after: null,
    lifecycle_run_id: null,
    lifecycle_error: null,
    lines_added: 0,
    lines_removed: 0,
    snapshot_url: null,
    snapshot_created_at: null,
    snapshot_size_bytes: null,
    cached_diff: null,
    cached_diff_updated_at: null,
    created_at: "2026-05-04T00:00:00.000Z",
    updated_at: "2026-05-04T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * A minimal valid `chats` row that tests can override per case.
 */
export function baseChatRow(overrides: Partial<ChatRow> = {}): ChatRow {
  return {
    id: "chat_1",
    session_id: "sess_1",
    title: "New chat",
    model_id: null,
    active_stream_id: null,
    last_assistant_message_at: null,
    created_at: "2026-05-04T00:00:00.000Z",
    updated_at: "2026-05-04T00:00:00.000Z",
    ...overrides,
  };
}

export const okAuth = {
  accountId: "acc-uuid-1",
  orgId: null,
  authToken: "key_test",
};
