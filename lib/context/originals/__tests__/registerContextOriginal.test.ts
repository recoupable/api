import { beforeEach, expect, it, vi } from "vitest";
import { registerContextOriginal } from "../registerContextOriginal";
import { ContextOriginalNeedsReconciliation } from "../ContextOriginalNeedsReconciliation";
import { verifyContextOriginal } from "../verifyContextOriginal";
import supabase from "@/lib/supabase/serverClient";
import { actor, owner, source, key, input, verified, receipt } from "./originalRegistrationFixture";
vi.mock("../verifyContextOriginal", () => ({ verifyContextOriginal: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(verifyContextOriginal).mockResolvedValue(verified);
  vi.mocked(supabase.rpc).mockResolvedValue({ data: receipt, error: null } as never);
});
it("routes verified bytes through the real allowed RPC and validates receipt", async () => {
  expect(await registerContextOriginal(actor, owner, input)).toEqual(receipt);
  expect(verifyContextOriginal).toHaveBeenCalledWith(actor, owner, key);
  expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith("register_context_original", {
    p_actor: actor,
    p_owner: owner,
    p_source: source,
    p_key: input.idempotencyKey,
    p_storage_path: key,
    p_sha256: verified.sha256,
    p_bytes: 26,
    p_media_type: "text/csv",
  });
  expect(vi.mocked(verifyContextOriginal).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(supabase.rpc).mock.invocationCallOrder[0],
  );
});
it.each(["sha256", "account_id", "bytes", "storage_path"])(
  "rejects caller override %s before storage",
  async field => {
    await expect(
      registerContextOriginal(actor, owner, { ...input, [field]: "override" }),
    ).rejects.not.toBeInstanceOf(ContextOriginalNeedsReconciliation);
    expect(verifyContextOriginal).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  },
);
it("does not dispatch after failed byte verification", async () => {
  vi.mocked(verifyContextOriginal).mockRejectedValue(new Error("Access revoked"));
  await expect(registerContextOriginal(actor, owner, input)).rejects.toThrow("Access revoked");
  expect(supabase.rpc).not.toHaveBeenCalled();
});
it("retains stable identity and original cause after a lost reply, without retry", async () => {
  const cause = new Error("Connection lost");
  vi.mocked(supabase.rpc).mockRejectedValue(cause);
  const error = await registerContextOriginal(actor, owner, input).catch(e => e);
  expect(error).toBeInstanceOf(ContextOriginalNeedsReconciliation);
  expect(error).toMatchObject({
    ownerId: owner,
    sourceId: source,
    idempotencyKey: input.idempotencyKey,
    cause,
  });
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
it.each([
  { owner_id: actor },
  { source_id: actor },
  { fingerprint: "b".repeat(64) },
  { bytes: 27 },
  { media_type: "application/pdf" },
  { rights_verified: true },
  { source_version_id: "bad" },
  { created_at: "bad" },
])("withholds mismatched post-write receipt %j", async patch => {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: { ...receipt, ...patch },
    error: null,
  } as never);
  await expect(registerContextOriginal(actor, owner, input)).rejects.toBeInstanceOf(
    ContextOriginalNeedsReconciliation,
  );
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
it("keeps a storage error uncertain after dispatch", async () => {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: null,
    error: { message: "database error" },
  } as never);
  await expect(registerContextOriginal(actor, owner, input)).rejects.toBeInstanceOf(
    ContextOriginalNeedsReconciliation,
  );
});
