import type { TablesInsert } from "@/types/database.types";
import { generateUUID } from "@/lib/uuid/generateUUID";

interface BuildSessionInsertRowInput {
  accountId: string;
  title: string;
  /**
   * Final clone URL resolved by the handler via `ensurePersonalRepo` —
   * always set on session create now that the body no longer carries
   * `cloneUrl`.
   */
  cloneUrl: string;
  /**
   * Optional artist account this session belongs to. Backs the chat
   * sidebar's artist filter; omitted for sessions not tied to an
   * artist context.
   */
  artistId?: string;
}

/**
 * Normalizes a validated `POST /api/sessions` body plus a resolved
 * title + ensured clone URL into a `sessions` insert row. Centralizes
 * the default / null-coalescing rules so the handler can stay focused
 * on HTTP and persistence flow.
 *
 * @param input - The validated body, owning account id, resolved title, resolved clone URL, and optional artist id.
 * @returns A row ready to pass to `insertSession`.
 */
export function buildSessionInsertRow(input: BuildSessionInsertRowInput): TablesInsert<"sessions"> {
  const { accountId, title, cloneUrl, artistId } = input;
  return {
    id: generateUUID(),
    account_id: accountId,
    artist_id: artistId ?? null,
    title,
    status: "running",
    branch: null,
    clone_url: cloneUrl,
    global_skill_refs: [],
    sandbox_state: { type: "vercel" },
    lifecycle_state: "provisioning",
    lifecycle_version: 0,
  };
}
