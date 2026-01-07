import supabase from "@/lib/supabase/serverClient";

export interface FileRecord {
  id: string;
  owner_account_id: string;
  artist_account_id: string;
  storage_key: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  description: string | null;
  tags: string[];
}

export interface CreateFileRecordParams {
  ownerAccountId: string;
  artistAccountId: string;
  storageKey: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  description?: string | null;
  tags?: string[];
}

/**
 * Create a file record in the database
 */
export async function createFileRecord(
  params: CreateFileRecordParams
): Promise<FileRecord> {
  const {
    ownerAccountId,
    artistAccountId,
    storageKey,
    fileName,
    mimeType,
    sizeBytes,
    description,
    tags,
  } = params;

  const { data, error } = await supabase
    .from("files")
    .insert({
      owner_account_id: ownerAccountId,
      artist_account_id: artistAccountId,
      storage_key: storageKey,
      file_name: fileName,
      mime_type: mimeType ?? null,
      size_bytes: sizeBytes ?? null,
      description: description ?? null,
      tags: Array.isArray(tags) ? tags : [],
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create file record: ${error.message}`);
  }

  return data;
}

