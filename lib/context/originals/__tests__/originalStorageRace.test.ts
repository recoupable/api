import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { storeContextOriginal } from "../storeContextOriginal";
import { ContextOriginalNeedsReconciliation } from "../ContextOriginalNeedsReconciliation";
import { authorizeContextOwner } from "../../authorizeContextOwner";
import supabase from "@/lib/supabase/serverClient";
import { actor, owner } from "./originalRegistrationFixture";
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
it("retains unknown storage state if authorization is revoked after upload", async () => {
  upload.mockImplementation(async () => {
    vi.mocked(authorizeContextOwner).mockRejectedValueOnce(new Error("Revoked"));
    return { data: { path: "stored" }, error: null };
  });
  await expect(storeContextOriginal(actor, owner, input, stream())).rejects.toBeInstanceOf(
    ContextOriginalNeedsReconciliation,
  );
  expect(upload).toHaveBeenCalledTimes(1);
  expect(download).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
it("withholds a receipt if raw storage changes between precheck and registration read", async () => {
  const text = "changed,csv\n",
    changed = new Blob([text]);
  download
    .mockResolvedValueOnce({ data: file, error: null })
    .mockResolvedValueOnce({ data: changed, error: null });
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: {
      ...saved,
      bytes: changed.size,
      fingerprint: createHash("sha256").update(text).digest("hex"),
    },
    error: null,
  } as never);
  const error = await storeContextOriginal(actor, owner, input, stream()).catch(e => e);
  expect(error).toBeInstanceOf(ContextOriginalNeedsReconciliation);
  expect(error.cause.message).toBe("Original changed during registration");
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
});

it("disconnect during pre-write authorization prevents upload", async () => {
  const c = new AbortController();
  vi.mocked(authorizeContextOwner).mockImplementation(async () => {
    c.abort();
    return { accountId: actor, ownerId: owner, organizationId: owner };
  });
  await expect(storeContextOriginal(actor, owner, input, stream(), c.signal)).rejects.toThrow(
    "disconnected",
  );
  expect(upload).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
});
