import { selectAccountInfo } from "@/lib/supabase/account_info/selectAccountInfo";
import { insertAccountInfo } from "@/lib/supabase/account_info/insertAccountInfo";
import { updateAccountInfo } from "@/lib/supabase/account_info/updateAccountInfo";
import type { Knowledge } from "@/lib/artist/knowledge";

export interface UpsertArtistInfoFieldsParams {
  artistId: string;
  image?: string;
  instruction?: string;
  label?: string;
  knowledges?: Knowledge[];
}

/**
 * Inserts or updates the `account_info` row for an artist, preserving any
 * fields the caller omits on update. Treats an empty-string label as an
 * explicit clear (null). De-duplicates knowledges by URL on update so repeat
 * entries don't accumulate.
 *
 * @param params - Partial set of artist info fields to persist
 */
export async function upsertArtistInfoFields({
  artistId,
  image,
  instruction,
  label,
  knowledges,
}: UpsertArtistInfoFieldsParams): Promise<void> {
  const existing = await selectAccountInfo(artistId);

  if (!existing) {
    await insertAccountInfo({
      account_id: artistId,
      image,
      instruction,
      knowledges,
      label: label === "" ? null : label,
    });
    return;
  }

  const nextKnowledges =
    knowledges !== undefined
      ? Array.from(new Map(knowledges.map(k => [k.url, k])).values())
      : existing.knowledges;

  await updateAccountInfo(artistId, {
    image: image ?? existing.image,
    instruction: instruction ?? existing.instruction,
    knowledges: nextKnowledges,
    label: label === undefined ? existing.label : label === "" ? null : label,
  });
}
