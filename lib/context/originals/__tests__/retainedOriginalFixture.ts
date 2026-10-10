import { createHash } from "node:crypto";
import { vi } from "vitest";
import supabase from "@/lib/supabase/serverClient";
import { receipt, key } from "./originalRegistrationFixture";
export const file = new Blob(["title,isrc\nSong,TEST12345\n"]);
export const saved = {
  ...receipt,
  bytes: file.size,
  fingerprint: createHash("sha256").update("title,isrc\nSong,TEST12345\n").digest("hex"),
};
export const internal = { ...saved, bucket: "context-private", storage_path: key };
const response = vi.fn();
export const download = vi.fn((_key: string) => ({
  asStream: async () => {
    const result = await response();
    return { ...result, data: result.data?.stream() };
  },
}));
export const from = vi.fn((_bucket: string) => ({ download }));
export function resetOriginal() {
  vi.resetAllMocks();
  from.mockReturnValue({ download });
  response.mockResolvedValue({ data: file, error: null });
  download.mockImplementation(() => ({
    asStream: async () => {
      const result = await response();
      return { ...result, data: result.data?.stream() };
    },
  }));
  vi.mocked(supabase.rpc)
    .mockResolvedValueOnce({ data: internal, error: null } as never)
    .mockResolvedValueOnce({ data: saved, error: null } as never);
}
