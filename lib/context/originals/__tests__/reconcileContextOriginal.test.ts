import { originalStorageFlowStream as stream } from "./originalStorageFlowStream";
import { beforeEach, expect, it, vi } from "vitest";
import { reconcileContextOriginal } from "../reconcileContextOriginal";
import { ContextOriginalNeedsReconciliation } from "../ContextOriginalNeedsReconciliation";
import supabase from "@/lib/supabase/serverClient";
import { actor, owner } from "./originalRegistrationFixture";
import {
  input,
  saved,
  from,
  upload,
  download,
  remove,
  resetStorageFlow,
} from "./originalStorageFlowFixture";
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: { rpc: vi.fn(), storage: { from: (bucket: string) => from(bucket) } },
}));
beforeEach(resetStorageFlow);
it("explicitly reconciles same stored bytes without writing storage or allocating a new key", async () => {
  expect(await reconcileContextOriginal(actor, owner, input, stream())).toEqual(saved);
  expect(upload).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(download).toHaveBeenCalledTimes(2);
  expect(supabase.rpc).toHaveBeenCalledWith(
    "register_context_original",
    expect.objectContaining({ p_key: input.idempotencyKey, p_source: input.sourceId }),
  );
});
it("withholds changed retry payload without overwriting existing bytes", async () => {
  await expect(
    reconcileContextOriginal(actor, owner, input, stream("changed,csv\n")),
  ).rejects.toBeInstanceOf(ContextOriginalNeedsReconciliation);
  expect(upload).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
it("keeps unavailable storage uncertain rather than proving original upload failed", async () => {
  download.mockResolvedValue({ data: null, error: new Error("Unavailable") });
  await expect(reconcileContextOriginal(actor, owner, input, stream())).rejects.toBeInstanceOf(
    ContextOriginalNeedsReconciliation,
  );
  expect(upload).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
