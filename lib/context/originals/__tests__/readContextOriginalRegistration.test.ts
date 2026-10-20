import { beforeEach, expect, it, vi } from "vitest";
import { readContextOriginalRegistration } from "../readContextOriginalRegistration";
import { authorizeContextOwner } from "../../authorizeContextOwner";
import supabase from "@/lib/supabase/serverClient";
import { actor, owner, id, receipt } from "./originalRegistrationFixture";
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(supabase.rpc).mockResolvedValue({ data: receipt, error: null } as never);
});
it("authorizes a fresh read and invokes the real allowed RPC", async () => {
  expect(await readContextOriginalRegistration(actor, owner, id)).toEqual(receipt);
  expect(authorizeContextOwner).toHaveBeenCalledWith(actor, owner);
  expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith("read_context_original_registration", {
    p_actor: actor,
    p_owner: owner,
    p_receipt: id,
  });
  expect(vi.mocked(authorizeContextOwner).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(supabase.rpc).mock.invocationCallOrder[0],
  );
});
it("does not read after revoked access", async () => {
  vi.mocked(authorizeContextOwner).mockRejectedValue(new Error("Access denied"));
  await expect(readContextOriginalRegistration(actor, owner, id)).rejects.toThrow("Access denied");
  expect(supabase.rpc).not.toHaveBeenCalled();
});
it.each([
  { id: actor },
  { owner_id: actor },
  { fingerprint: "A".repeat(64) },
  { status: "accepted" },
  { bytes: 0 },
  { storage_path: "private" },
])("rejects unexpected returned metadata %j", async patch => {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: { ...receipt, ...patch },
    error: null,
  } as never);
  await expect(readContextOriginalRegistration(actor, owner, id)).rejects.toThrow();
});
it("validates receipt identity before authorization or RPC", async () => {
  await expect(readContextOriginalRegistration(actor, owner, "bad")).rejects.toThrow();
  expect(authorizeContextOwner).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
});
