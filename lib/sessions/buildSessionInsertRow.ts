import type { TablesInsert } from "@/types/database.types";
import type { CreateSessionBody } from "@/lib/sessions/validateCreateSessionBody";
import { generateUUID } from "@/lib/uuid/generateUUID";

interface BuildSessionInsertRowInput {
  body: CreateSessionBody;
  accountId: string;
  title: string;
  /**
   * Final clone URL resolved by the handler via `ensurePersonalRepo` —
   * always set on session create now that the body no longer carries
   * `cloneUrl`.
   */
  cloneUrl: string;
}

/**
 * Normalizes a validated `POST /api/sessions` body plus a resolved
 * title + ensured clone URL into a `sessions` insert row. Centralizes
 * the default / null-coalescing rules so the handler can stay focused
 * on HTTP and persistence flow.
 *
 * @param input - The validated body, owning account id, resolved title, and resolved clone URL.
 * @returns A row ready to pass to `insertSession`.
 */
export function buildSessionInsertRow(input: BuildSessionInsertRowInput): TablesInsert<"sessions"> {
  const { body, accountId, title, cloneUrl } = input;
  return {
    id: generateUUID(),
    account_id: accountId,
    title,
    status: "running",
    branch: null,
    clone_url: cloneUrl,
    global_skill_refs: [],
    sandbox_state: { type: body.sandboxType ?? "vercel" },
    lifecycle_state: "provisioning",
    lifecycle_version: 0,
  };
}
