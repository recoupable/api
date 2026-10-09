import { beforeEach, expect, it, vi } from "vitest";
import { ContextOriginalNeedsReconciliation } from "../ContextOriginalNeedsReconciliation";
import { registerContextOriginal } from "../registerContextOriginal";
import { readContextOriginalRegistration } from "../readContextOriginalRegistration";
import { verifyContextOriginal } from "../verifyContextOriginal";
import { authorizeContextOwner } from "../../authorizeContextOwner";
import supabase from "@/lib/supabase/serverClient";
import { actor, owner, source, key, input, verified, receipt } from "./originalRegistrationFixture";
vi.mock("../verifyContextOriginal", () => ({ verifyContextOriginal: vi.fn() }));
vi.mock("../../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(verifyContextOriginal).mockResolvedValue(verified);
  vi.mocked(supabase.rpc).mockResolvedValue({ data: receipt, error: null } as never);
});
it("keeps recovery identity and cause accessible but out of generic serialization", () => {
  const cause = new Error("private details");
  const error = new ContextOriginalNeedsReconciliation(owner, source, "private-key", cause);
  expect(error).toMatchObject({
    ownerId: owner,
    sourceId: source,
    idempotencyKey: "private-key",
    cause,
  });
  expect(JSON.stringify(error)).not.toContain(owner);
  expect(JSON.stringify(error)).not.toContain(source);
  expect(JSON.stringify(error)).not.toContain("private-key");
  expect({ ...error }).not.toHaveProperty("ownerId");
  for (const field of ["ownerId", "sourceId", "idempotencyKey", "cause"])
    expect(Object.getOwnPropertyDescriptor(error, field)?.enumerable).toBe(false);
});
it("normalizes UUID inputs for read scope and returned receipt comparisons", async () => {
  const identity = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const owned = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const receiptId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: { ...receipt, id: receiptId, owner_id: owned },
    error: null,
  } as never);
  expect(
    await readContextOriginalRegistration(
      identity.toUpperCase(),
      owned.toUpperCase(),
      receiptId.toUpperCase(),
    ),
  ).toMatchObject({ id: receiptId });
  expect(authorizeContextOwner).toHaveBeenCalledWith(identity, owned);
  expect(supabase.rpc).toHaveBeenCalledWith("read_context_original_registration", {
    p_actor: identity,
    p_owner: owned,
    p_receipt: receiptId,
  });
});
it("normalizes source identity before verification, dispatch and post-write checks", async () => {
  const sourceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: { ...receipt, source_id: sourceId },
    error: null,
  } as never);
  expect(
    await registerContextOriginal(actor, owner, { ...input, sourceId: sourceId.toUpperCase() }),
  ).toMatchObject({ source_id: sourceId });
  expect(supabase.rpc).toHaveBeenCalledWith(
    "register_context_original",
    expect.objectContaining({ p_source: sourceId }),
  );
});
it("allows the database version identity to differ from the storage object UUID", async () => {
  const versionId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  expect(key).not.toContain(versionId);
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: { ...receipt, source_version_id: versionId },
    error: null,
  } as never);
  expect(await registerContextOriginal(actor, owner, input)).toMatchObject({
    source_version_id: versionId,
  });
});
