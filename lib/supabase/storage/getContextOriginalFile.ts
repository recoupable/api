import supabase from "@/lib/supabase/serverClient";
import { z } from "zod";
import { readBoundedOriginalStream } from "@/lib/context/originals/readBoundedOriginalStream";

/** Server storage utility; callers must authorize the owner before and after reading. */
export async function getContextOriginalFile(key: string, maxBytes?: number): Promise<Blob> {
  if (maxBytes !== undefined) {
    z.number()
      .int()
      .min(1)
      .max(50 * 1024 * 1024)
      .parse(maxBytes);
    const { data, error } = await supabase.storage.from("context-private").download(key).asStream();
    if (error || !data) throw new Error("Private original unavailable");
    return readBoundedOriginalStream(data, { maxBytes, timeoutMs: 30000 });
  }
  const { data, error } = await supabase.storage.from("context-private").download(key);
  if (error || !data) throw new Error("Private original unavailable");
  if (!data.size || data.size > 50 * 1024 * 1024)
    throw new Error("Original exceeds supported size or is empty");
  return data;
}
