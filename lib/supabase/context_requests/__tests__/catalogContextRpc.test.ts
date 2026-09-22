import { beforeEach, expect, it, vi } from "vitest";
import { callContextRpc } from "../callContextRpc";
import { processContextOperation } from "@/lib/context/processContextOperation";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../serverClient", () => ({ default: { rpc } }));
vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const account = "00000000-0000-4000-8000-000000000001";
const catalog = "00000000-0000-4000-8000-000000000002";
const dispatch = vi.fn();
const ingest = () =>
  processContextOperation(
    account,
    { action: "ingest_catalog", catalog_id: catalog, idempotency_key: "catalog-test" },
    {
      authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
      rpc: callContextRpc,
      dispatch,
    },
  );
beforeEach(() => vi.clearAllMocks());
it("passes authorized catalog ingestion through the real database adapter", async () => {
  rpc.mockResolvedValue({ data: { id: "request", status: "partial" }, error: null });
  const result = await ingest();
  expect(rpc).toHaveBeenCalledWith("create_catalog_context_request", {
    p_owner: account,
    p_actor: account,
    p_catalog: catalog,
    p_key: "catalog-test",
  });
  expect("request" in result && result.request?.status).toBe("partial");
  expect(dispatch).not.toHaveBeenCalled();
});
it("propagates database permission failures without dispatching work", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "Catalog access denied" } });
  await expect(ingest()).rejects.toThrow("Context storage operation failed: Catalog access denied");
  expect(dispatch).not.toHaveBeenCalled();
});
it("continues rejecting operations outside the context allowlist", async () => {
  await expect(callContextRpc("unrelated_operation", {})).rejects.toThrow(
    "Unknown context operation",
  );
  expect(rpc).not.toHaveBeenCalled();
});
