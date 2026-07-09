import { z } from "zod";
import type { Json } from "@/types/database.types";

const newPostUrlsSchema = z.array(z.string());

/**
 * Parses the `new_post_urls` JSONB column into a string array. JSONB is the
 * one column the generated types can't narrow past `Json`, so this is the
 * runtime boundary: anything malformed degrades to "no new posts" instead of
 * crashing the digest assembler.
 */
export function parseNewPostUrls(value: Json | null): string[] {
  const result = newPostUrlsSchema.safeParse(value);
  return result.success ? result.data : [];
}
