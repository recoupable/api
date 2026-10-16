import { beforeEach, expect, it, vi } from "vitest";
import { readRetainedContextOriginal } from "../readRetainedContextOriginal";
import supabase from "@/lib/supabase/serverClient";
import { actor, owner, id, key } from "./originalRegistrationFixture";
import { file, saved, internal, from, download, resetOriginal } from "./retainedOriginalFixture";
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: { rpc: vi.fn(), storage: { from: (bucket: string) => from(bucket) } },
}));
beforeEach(resetOriginal);
it("retrieves a neutral-path original without exposing its internal path", async () => {
  const neutral = key.replace(/\.csv$/, ".original");
  vi.mocked(supabase.rpc)
    .mockReset()
    .mockResolvedValueOnce({ data: { ...internal, storage_path: neutral }, error: null } as never)
    .mockResolvedValueOnce({ data: saved, error: null } as never);
  const result = await readRetainedContextOriginal(actor, owner, id);
  expect(result).toEqual({ receipt: saved, file });
  expect(download).toHaveBeenCalledExactlyOnceWith(neutral);
  expect(result).not.toHaveProperty("storage_path");
});

vi.mock("@/lib/supabase/storage/getContextOriginalDownload", () => ({
  getContextOriginalDownload: (key: string) => from("context-private").download(key).asStream(),
}));
