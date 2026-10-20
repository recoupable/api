import supabase from "@/lib/supabase/serverClient";

/** Server storage utility; callers must authorize the owner before and after reading. */
export async function getContextOriginalFile(key: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from("context-private").download(key);
  if (error || !data) throw new Error("Private original unavailable");
  if (!data.size || data.size > 50 * 1024 * 1024)
    throw new Error("Original exceeds supported size or is empty");
  return data;
}
