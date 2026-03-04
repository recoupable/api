import supabase from "@/lib/supabase/serverClient";
import type { FileRecord } from "@/lib/supabase/files/createFileRecord";

/**
 * Select a file record by storage key for an owner account.
 *
 * @param root0
 * @param root0.ownerAccountId
 * @param root0.storageKey
 */
export async function selectFileByStorageKey({
  ownerAccountId,
  storageKey,
}: {
  ownerAccountId: string;
  storageKey: string;
}): Promise<FileRecord | null> {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("owner_account_id", ownerAccountId)
    .eq("storage_key", storageKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to select file by storage key: ${error.message}`);
  }

  return data;
}
