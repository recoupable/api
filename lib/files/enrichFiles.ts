import type { Tables } from "@/types/database.types";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

type FileRecord = Tables<"files">;

export type ListedFileRecord = FileRecord & {
  owner_email: string | null;
};

/**
 * Enriches file rows with the owner's email address when available.
 *
 * @param files - File rows from the database.
 * @returns The file rows with owner_email attached.
 */
export async function enrichFiles(files: FileRecord[]): Promise<ListedFileRecord[]> {
  const ownerIds = Array.from(new Set(files.map(file => file.owner_account_id)));
  const ownerEmailRows = ownerIds.length ? await selectAccountEmails({ accountIds: ownerIds }) : [];

  const ownerEmails = new Map<string, string | null>();
  const ownerEmailUpdatedAts = new Map<string, string | null>();
  for (const row of ownerEmailRows) {
    if (!row.account_id) continue;

    const existingUpdatedAt = ownerEmailUpdatedAts.get(row.account_id);
    if (existingUpdatedAt && row.updated_at <= existingUpdatedAt) continue;

    ownerEmails.set(row.account_id, row.email ?? null);
    ownerEmailUpdatedAts.set(row.account_id, row.updated_at);
  }

  return files.map(file => ({
    ...file,
    owner_email: ownerEmails.get(file.owner_account_id) ?? null,
  }));
}
