import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const account = "00000000-0000-4000-8000-000000000001",
  catalog = "00000000-0000-4000-8000-000000000002";
it("derives catalog owner from authorized workspace and does not dispatch Spotify extraction", async () => {
  const rpc = vi.fn(async () => ({ id: "request", status: "partial" })),
    dispatch = vi.fn();
  const result = await processContextOperation(
    account,
    { action: "ingest_catalog", catalog_id: catalog, idempotency_key: "catalog-test" },
    {
      authorize: async () => ({ accountId: account, ownerId: account, organizationId: null }),
      rpc,
      dispatch,
    },
  );
  expect(rpc).toHaveBeenCalledWith("create_catalog_context_request", {
    p_owner: account,
    p_actor: account,
    p_catalog: catalog,
    p_key: "catalog-test",
  });
  expect("request" in result ? result.request?.status : null).toBe("partial");
  expect(dispatch).not.toHaveBeenCalled();
});
it("rejects account overrides before database operations", async () => {
  const rpc = vi.fn();
  await expect(
    processContextOperation(
      account,
      { action: "ingest_catalog", account_id: account, catalog_id: catalog, idempotency_key: "x" },
      { rpc, dispatch: vi.fn() },
    ),
  ).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
