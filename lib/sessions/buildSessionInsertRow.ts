import type { TablesInsert } from "@/types/database.types";
import type { CreateSessionBody } from "@/lib/sessions/validateCreateSessionBody";
import { generateUUID } from "@/lib/uuid/generateUUID";

interface BuildSessionInsertRowInput {
  body: CreateSessionBody;
  accountId: string;
  title: string;
}

/**
 * Normalizes a validated `POST /api/sessions` body plus a resolved
 * title into a `sessions` insert row. Centralizes the default /
 * null-coalescing rules so the handler can stay focused on HTTP and
 * persistence flow.
 *
 * Title resolution is intentionally not done here — that lives in
 * `resolveSessionTitle` so this function stays synchronous and pure.
 *
 * @param input - The validated body, owning account id, and resolved title.
 * @returns A row ready to pass to `insertSession`.
 */
export function buildSessionInsertRow(input: BuildSessionInsertRowInput): TablesInsert<"sessions"> {
  const { body, accountId, title } = input;
  return {
    id: generateUUID(),
    account_id: accountId,
    title,
    status: "running",
    branch: body.branch ?? null,
    clone_url: body.cloneUrl ?? null,
    global_skill_refs: [],
    sandbox_state: { type: body.sandboxType ?? "vercel" },
    lifecycle_state: "provisioning",
    lifecycle_version: 0,
  };
}
