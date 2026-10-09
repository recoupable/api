import { beforeEach, expect, it, vi } from "vitest";
import { storeContextOriginal } from "../storeContextOriginal";
import { ContextOriginalNeedsReconciliation } from "../ContextOriginalNeedsReconciliation";
import { authorizeContextOwner } from "../../authorizeContextOwner";
import supabase from "@/lib/supabase/serverClient";
import { actor, owner, source } from "./originalRegistrationFixture";
import {
  file,
  input,
  saved,
  from,
  upload,
  download,
  remove,
  stream,
  resetStorageFlow,
} from "./originalStorageFlowFixture";
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: { rpc: vi.fn(), storage: { from: (bucket: string) => from(bucket) } },
}));
beforeEach(resetStorageFlow);
it("writes privately once without overwrite, verifies stored bytes then registers", async () => {
  expect(await storeContextOriginal(actor, owner, input, stream())).toEqual(saved);
  expect(upload).toHaveBeenCalledTimes(1);
  expect(upload).toHaveBeenCalledWith(
    expect.stringContaining(`${owner}/context-originals/`),
    file,
    { contentType: "text/csv", upsert: false },
  );
  expect(from.mock.calls.every(([bucket]) => bucket === "context-private")).toBe(true);
  expect(download).toHaveBeenCalledTimes(2);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
  expect(vi.mocked(authorizeContextOwner).mock.invocationCallOrder[3]).toBeLessThan(
    upload.mock.invocationCallOrder[0],
  );
  expect(upload.mock.invocationCallOrder[0]).toBeLessThan(download.mock.invocationCallOrder[0]);
  expect(download.mock.invocationCallOrder[1]).toBeLessThan(
    vi.mocked(supabase.rpc).mock.invocationCallOrder[0],
  );
});
it("stops before writing if scope changes after preparation", async () => {
  vi.mocked(authorizeContextOwner)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("Revoked"));
  await expect(storeContextOriginal(actor, owner, input, stream())).rejects.toThrow("Revoked");
  expect(upload).not.toHaveBeenCalled();
});
it.each(["rejected", "returned"])(
  "preserves identity on %s upload error, with no retry/delete",
  async mode => {
    const cause = new Error("Lost upload reply");
    if (mode === "rejected") upload.mockRejectedValue(cause);
    else upload.mockResolvedValue({ data: null, error: cause });
    const error = await storeContextOriginal(actor, owner, input, stream()).catch(e => e);
    expect(error).toBeInstanceOf(ContextOriginalNeedsReconciliation);
    expect(error).toMatchObject({
      ownerId: owner,
      sourceId: source,
      idempotencyKey: input.idempotencyKey,
    });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(download).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  },
);
it("does not register bytes that differ from prepared input", async () => {
  download.mockResolvedValue({ data: new Blob(["changed,csv\n"]), error: null });
  await expect(storeContextOriginal(actor, owner, input, stream())).rejects.toBeInstanceOf(
    ContextOriginalNeedsReconciliation,
  );
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
it("withholds a changed post-write receipt and preserves recovery identity", async () => {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: { ...saved, fingerprint: "b".repeat(64) },
    error: null,
  } as never);
  await expect(storeContextOriginal(actor, owner, input, stream())).rejects.toBeInstanceOf(
    ContextOriginalNeedsReconciliation,
  );
  expect(remove).not.toHaveBeenCalled();
});
it("does not retry a lost registration acknowledgement", async () => {
  vi.mocked(supabase.rpc).mockRejectedValue(new Error("Lost save reply"));
  await expect(storeContextOriginal(actor, owner, input, stream())).rejects.toBeInstanceOf(
    ContextOriginalNeedsReconciliation,
  );
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(upload).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
});
