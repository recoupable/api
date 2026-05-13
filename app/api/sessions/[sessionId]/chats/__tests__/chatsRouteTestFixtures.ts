import { NextRequest } from "next/server";
import type { Tables } from "@/types/database.types";

export type SessionRow = Tables<"sessions">;
export type ChatRow = Tables<"chats">;

export function makeChatsListReq(
  url = "https://example.com/api/sessions/sess_1/chats",
): NextRequest {
  return new NextRequest(url);
}

export const mockSession: SessionRow = {
  id: "sess_1",
  account_id: "acc-uuid-1",
  title: "Test session",
  status: "running",
  repo_owner: "acme",
  repo_name: "demo",
  branch: "main",
  clone_url: "https://github.com/acme/demo.git",
  is_new_branch: false,
  global_skill_refs: [],
  sandbox_state: { type: "vercel" },
  lifecycle_state: "active",
  lifecycle_version: 1,
  last_activity_at: "2026-05-04T00:00:00.000Z",
  sandbox_expires_at: null,
  hibernate_after: null,
  lifecycle_run_id: null,
  lifecycle_error: null,
  lines_added: 12,
  lines_removed: 3,
  snapshot_url: null,
  snapshot_created_at: null,
  snapshot_size_bytes: null,
  cached_diff: null,
  cached_diff_updated_at: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-04T00:00:00.000Z",
};

export function baseChat(overrides: Partial<ChatRow> = {}): ChatRow {
  return {
    id: "chat_1",
    session_id: "sess_1",
    title: "New chat",
    model_id: "openai/gpt-5",
    active_stream_id: null,
    last_assistant_message_at: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}
