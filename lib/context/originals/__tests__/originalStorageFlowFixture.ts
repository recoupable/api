import { createHash } from "node:crypto";
import { vi } from "vitest";
import supabase from "@/lib/supabase/serverClient";
import { source, receipt } from "./originalRegistrationFixture";
export const text = "title,isrc\nSong,TEST12345\n";
export const file = new Blob([text]);
export const input = { sourceId: source, idempotencyKey: "flow-1", mediaType: "text/csv" };
export const saved = {
  ...receipt,
  fingerprint: createHash("sha256").update(text).digest("hex"),
  bytes: file.size,
};
export const upload = vi.fn(),
  download = vi.fn(),
  remove = vi.fn();
export const from = vi.fn((_bucket: string) => ({ upload, download, remove }));
export function resetStorageFlow() {
  vi.resetAllMocks();
  from.mockReturnValue({ upload, download, remove });
  upload.mockResolvedValue({ data: { path: "stored" }, error: null });
  download.mockResolvedValue({ data: file, error: null });
  vi.mocked(supabase.rpc).mockResolvedValue({ data: saved, error: null } as never);
}
