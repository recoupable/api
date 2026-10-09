import { CONTEXT_PRIVATE_BUCKET } from "@/lib/supabase/storage/const";
import { createHash } from "node:crypto";
import { z } from "zod";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { getContextOriginalFile } from "@/lib/supabase/storage/getContextOriginalFile";

/** Verify stored original bytes in current workspace scope; no parsing or rights decision. */
export async function verifyContextOriginal(
  actor: string,
  owner: string,
  key: string,
  load: (key: string) => Promise<Blob> = getContextOriginalFile,
) {
  actor = z.string().uuid().parse(actor).toLowerCase();
  owner = z.string().uuid().parse(owner).toLowerCase();
  const match = new RegExp(`^${owner}/context-originals/([a-f0-9-]{36})\\.(pdf|csv)$`).exec(key);
  if (!match || !z.string().uuid().safeParse(match[1]).success)
    throw new Error("Original must belong to the selected workspace");
  await authorizeContextOwner(actor, owner === actor ? undefined : owner);
  const file = await load(key);
  if (!file.size || file.size > 50 * 1024 * 1024)
    throw new Error("Original exceeds supported size or is empty");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size) throw new Error("Original size changed during read");
  if (match[2] === "pdf") {
    if (
      !/^%PDF-(1\.[0-7]|2\.0)/.test(bytes.toString("latin1", 0, 8)) ||
      !bytes.subarray(-1024).includes(Buffer.from("%%EOF"))
    )
      throw new Error("Original is not a recognizable PDF container");
  } else {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text))
      throw new Error("Original is not supported UTF-8 text");
  }
  await authorizeContextOwner(actor, owner === actor ? undefined : owner);
  return {
    bucket: CONTEXT_PRIVATE_BUCKET,
    key,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    mediaType: match[2] === "pdf" ? "application/pdf" : "text/csv",
  };
}
