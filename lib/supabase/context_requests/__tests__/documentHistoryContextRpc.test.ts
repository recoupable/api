import { beforeEach, expect, it, vi } from "vitest";
import { callContextRpc } from "../callContextRpc";
import { processContextOperation } from "@/lib/context/processContextOperation";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const account = "00000000-0000-4000-8000-000000000001";
const document = "00000000-0000-4000-8000-000000000002";
const readHistory = () =>
  processContextOperation(
    account,
    { action: "read_document_history", document_id: document, before_revision: 3, limit: 10 },
    {
      authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
      rpc: callContextRpc,
      dispatch: vi.fn(),
    },
  );
beforeEach(() => vi.clearAllMocks());
it("passes an authorized lineage read through the real database adapter", async () => {
  const history = { document: { id: document }, versions: [], has_more: false, next_before: null };
  rpc.mockResolvedValue({ data: history, error: null });
  expect(await readHistory()).toEqual({ state: "found", ...history });
  expect(rpc).toHaveBeenCalledExactlyOnceWith("read_context_document_history", {
    p_owner: account,
    p_document: document,
    p_before: 3,
    p_limit: 10,
  });
});
it("reports a null adapter read as not found and propagates storage failures", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: null });
  expect(await readHistory()).toMatchObject({ state: "not_found", document: null, versions: [] });
  rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
  await expect(readHistory()).rejects.toThrow(
    "Context storage operation failed: permission denied",
  );
});
