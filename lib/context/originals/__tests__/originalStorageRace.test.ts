import { originalStorageFlowStream as stream } from "./originalStorageFlowStream";
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
  expect(error.cause.message).toBe("Original changed before registration");
  expect(supabase.rpc).not.toHaveBeenCalled();
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

it("simultaneous changed-type retries use one no-overwrite object", async () => {
  const objects = new Map<string, Blob>();
  upload.mockImplementation(async (key: string, file: Blob, options: { upsert: boolean }) => {
    expect(options.upsert).toBe(false);
    if (objects.has(key)) return { data: null, error: new Error("Object exists") };
    objects.set(key, file);
    return { data: { path: key }, error: null };
  });
  download.mockImplementation(async (key: string) => ({ data: objects.get(key), error: null }));
  const outcomes = await Promise.allSettled([
    storeContextOriginal(actor, owner, input, stream()),
    storeContextOriginal(
      actor,
      owner,
      { ...input, mediaType: "application/pdf" },
      stream("%PDF-1.7\nfixture\n%%EOF"),
    ),
  ]);
  expect(upload.mock.calls[0][0]).toBe(upload.mock.calls[1][0]);
  expect(objects.size).toBe(1);
  expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
});
