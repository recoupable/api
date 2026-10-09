import { beforeEach, expect, it, vi } from "vitest";
import { readRetainedContextOriginal } from "../readRetainedContextOriginal";
import supabase from "@/lib/supabase/serverClient";
import { actor, owner, id } from "./originalRegistrationFixture";
import { file, saved, internal, from, download, resetOriginal } from "./retainedOriginalFixture";
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: { rpc: vi.fn(), storage: { from: (bucket: string) => from(bucket) } },
}));
beforeEach(resetOriginal);
it("denies oversized retained metadata before downloading", async () => {
  await expect(readRetainedContextOriginal(actor, owner, id, file.size - 1)).rejects.toThrow();
  expect(download).not.toHaveBeenCalled();
});
it.each([0, -1, 52428801, NaN, 1.5])(
  "denies invalid internal payload bound %s before lookup",
  async bound => {
    await expect(readRetainedContextOriginal(actor, owner, id, bound)).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  },
);
it("returns verified bytes exactly at the trusted bound", async () => {
  expect(await readRetainedContextOriginal(actor, owner, id, file.size)).toEqual({
    receipt: saved,
    file,
  });
});
it("withholds a storage replacement exceeding the bound", async () => {
  vi.mocked(supabase.rpc)
    .mockReset()
    .mockResolvedValueOnce({ data: internal, error: null } as never);
  const replacement = new Blob(["title,isrc\n" + "Song,TEST\n".repeat(20)]);
  const arrayBuffer = vi.spyOn(Blob.prototype, "arrayBuffer");
  download.mockReturnValueOnce({
    asStream: async () => ({ data: replacement.stream(), error: null }),
  } as never);
  await expect(readRetainedContextOriginal(actor, owner, id, file.size)).rejects.toThrow(
    "Original exceeds preparation limit",
  );
  expect(arrayBuffer).not.toHaveBeenCalled();
  arrayBuffer.mockRestore();
});

vi.mock("@/lib/supabase/storage/getContextOriginalDownload", () => ({
  getContextOriginalDownload: (key: string) => from("context-private").download(key).asStream(),
}));
