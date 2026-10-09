import supabase from "@/lib/supabase/serverClient";
import { z } from "zod";
import { getContextOriginalDownload } from "./getContextOriginalDownload";
import { readBoundedOriginalStream } from "@/lib/context/originals/readBoundedOriginalStream";

/** Server storage utility; callers must authorize the owner before and after reading. */
export async function getContextOriginalFile(key: string, maxBytes?: number): Promise<Blob> {
  if (maxBytes !== undefined) {
    z.number()
      .int()
      .min(1)
      .max(50 * 1024 * 1024)
      .parse(maxBytes);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopped = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("Private original unavailable"));
      }, 30000);
    });
    try {
      let result: Awaited<ReturnType<typeof getContextOriginalDownload>>;
      try {
        result = await Promise.race([getContextOriginalDownload(key, controller.signal), stopped]);
      } catch {
        throw new Error("Private original unavailable");
      }
      if (result.error || !result.data) throw new Error("Private original unavailable");
      return await readBoundedOriginalStream(result.data, { maxBytes, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
  const { data, error } = await supabase.storage.from("context-private").download(key);
  if (error || !data) throw new Error("Private original unavailable");
  if (!data.size || data.size > 50 * 1024 * 1024)
    throw new Error("Original exceeds supported size or is empty");
  return data;
}
