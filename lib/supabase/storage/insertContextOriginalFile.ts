import supabase from "../serverClient";
/** Trusted server insertion only; domain must authorize and preserve stable key. */
export async function insertContextOriginalFile(key: string, file: Blob, mediaType: string) {
  const { error } = await supabase.storage.from("context-private").upload(key, file, {
    contentType: mediaType,
    upsert: false,
  });
  if (error) throw new Error("Original storage acknowledgement unavailable", { cause: error });
}
