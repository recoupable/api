import type { TablesInsert } from "@/types/database.types";
import type { CreateSessionBody } from "@/lib/sessions/validateCreateSessionBody";
import { generateUUID } from "@/lib/uuid/generateUUID";

const DEFAULT_TITLE = "New session";

interface BuildSessionInsertRowInput {
  body: CreateSessionBody;
  accountId: string;
}

/**
 * Normalizes a validated `POST /api/sessions` body into a `sessions`
 * insert row. Centralizes the trim / default / null-coalescing rules
 * so the handler can stay focused on HTTP and persistence flow.
 *
 * @param input - The validated body and the authenticated account id.
 * @returns A row ready to pass to `insertSession`.
 */
export function buildSessionInsertRow(input: BuildSessionInsertRowInput): TablesInsert<"sessions"> {
  const { body, accountId } = input;
  return {
    id: generateUUID(),
    account_id: accountId,
    title: body.title?.trim() || DEFAULT_TITLE,
    status: "running",
    repo_owner: body.repoOwner ?? null,
    repo_name: body.repoName ?? null,
    branch: body.branch ?? null,
    clone_url: body.cloneUrl ?? null,
    global_skill_refs: [],
    sandbox_state: { type: body.sandboxType ?? "vercel" },
    lifecycle_state: "provisioning",
    lifecycle_version: 0,
  };
}
