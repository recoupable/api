import { beforeEach, expect, it, vi } from "vitest";
import { readRetainedContextOriginal } from "../readRetainedContextOriginal";
import { authorizeContextOwner } from "../../authorizeContextOwner";
import supabase from "@/lib/supabase/serverClient";
import { actor, owner, id, key } from "./originalRegistrationFixture";
import { file, saved, internal, from, download, resetOriginal } from "./retainedOriginalFixture";
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: { rpc: vi.fn(), storage: { from: (bucket: string) => from(bucket) } },
}));
beforeEach(resetOriginal);
it("verifies real bytes, then rereads current receipt before returning a private Blob", async () => {
  expect(await readRetainedContextOriginal(actor, owner, id)).toEqual({ receipt: saved, file });
  expect(supabase.rpc).toHaveBeenNthCalledWith(1, "get_context_original_retrieval", {
    p_actor: actor,
    p_owner: owner,
    p_receipt: id,
  });
  expect(supabase.rpc).toHaveBeenNthCalledWith(2, "read_context_original_registration", {
    p_actor: actor,
    p_owner: owner,
    p_receipt: id,
  });
  expect(from).toHaveBeenCalledExactlyOnceWith("context-private");
  expect(download).toHaveBeenCalledExactlyOnceWith(key);
  const auth = vi.mocked(authorizeContextOwner).mock.invocationCallOrder;
  const rpc = vi.mocked(supabase.rpc).mock.invocationCallOrder;
  expect(auth[0]).toBeLessThan(rpc[0]);
  expect(rpc[0]).toBeLessThan(download.mock.invocationCallOrder[0]);
  expect(auth[1]).toBeLessThan(download.mock.invocationCallOrder[0]);
  expect(auth[2]).toBeGreaterThan(download.mock.invocationCallOrder[0]);
  expect(rpc[1]).toBeGreaterThan(auth[3]);
});
it.each([
  { owner_id: actor },
  { id: actor },
  { bucket: "user-files" },
  { storage_path: key.replace(owner, actor) },
  { raw_content: "secret" },
])("withholds unexpected internal tuple %j", async patch => {
  vi.mocked(supabase.rpc)
    .mockReset()
    .mockResolvedValueOnce({ data: { ...internal, ...patch }, error: null } as never);
  await expect(readRetainedContextOriginal(actor, owner, id)).rejects.toThrow();
  expect(download).not.toHaveBeenCalled();
});
it("denies before lookup when initial access is revoked", async () => {
  vi.mocked(authorizeContextOwner).mockRejectedValueOnce(new Error("Revoked"));
  await expect(readRetainedContextOriginal(actor, owner, id)).rejects.toThrow("Revoked");
  expect(supabase.rpc).not.toHaveBeenCalled();
});
it("withholds the Blob when membership is revoked after storage read", async () => {
  vi.mocked(authorizeContextOwner)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("Revoked"));
  await expect(readRetainedContextOriginal(actor, owner, id)).rejects.toThrow("Revoked");
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
it("withholds bytes when withdrawal occurs before final receipt read", async () => {
  vi.mocked(supabase.rpc)
    .mockReset()
    .mockResolvedValueOnce({ data: internal, error: null } as never)
    .mockResolvedValueOnce({ data: null, error: { message: "Original unavailable" } } as never);
  await expect(readRetainedContextOriginal(actor, owner, id)).rejects.toThrow();
  expect(download).toHaveBeenCalledTimes(1);
});
it.each([
  { fingerprint: "b".repeat(64) },
  { bytes: file.size + 1 },
  { media_type: "application/pdf" },
])("rejects bytes inconsistent with retained metadata %j", async patch => {
  vi.mocked(supabase.rpc)
    .mockReset()
    .mockResolvedValueOnce({ data: { ...internal, ...patch }, error: null } as never);
  await expect(readRetainedContextOriginal(actor, owner, id)).rejects.toThrow();
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
it.each([
  { source_version_id: actor },
  { source_id: actor },
  { fingerprint: "b".repeat(64) },
  { bytes: 1 },
])("rejects changed final receipt %j", async patch => {
  vi.mocked(supabase.rpc)
    .mockReset()
    .mockResolvedValueOnce({ data: internal, error: null } as never)
    .mockResolvedValueOnce({ data: { ...saved, ...patch }, error: null } as never);
  await expect(readRetainedContextOriginal(actor, owner, id)).rejects.toThrow();
});
it("does not lookup invalid receipt identity", async () => {
  await expect(readRetainedContextOriginal(actor, owner, "bad")).rejects.toThrow();
  expect(supabase.rpc).not.toHaveBeenCalled();
});

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
