import { beforeEach, expect, it, vi } from "vitest";
import { callContextRpc } from "../callContextRpc";
import supabase from "../../serverClient";
vi.mock("../../serverClient", () => ({ default: { rpc: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
it("maps only the dedicated Catalog save size discriminator", async () => {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: null,
    error: { code: "22001", message: "CATALOG_SNAPSHOT_TOO_LARGE", details: "private snapshot" },
  } as never);
  await expect(callContextRpc("save_context_catalog_case", {})).rejects.toMatchObject({
    name: "CatalogSnapshotTooLargeError",
    code: "catalog_snapshot_too_large",
    status: 400,
  });
});
it.each([
  ["read_context_catalog_case", "22001", "CATALOG_SNAPSHOT_TOO_LARGE"],
  ["save_context_catalog_case", "22023", "CATALOG_SNAPSHOT_TOO_LARGE"],
  ["save_context_catalog_case", "23514", "CATALOG_SNAPSHOT_TOO_LARGE"],
  ["save_context_catalog_case", "22001", "prefix CATALOG_SNAPSHOT_TOO_LARGE"],
  ["save_context_catalog_case", "22023", "Invalid catalog snapshot"],
  ["save_context_catalog_case", "40001", "Catalog revision conflict"],
  ["save_context_catalog_case", "42501", "Forbidden"],
])("retains generic behavior for %s %s %s", async (name, code, message) => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { code, message } } as never);
  await expect(callContextRpc(name, {})).rejects.toEqual(
    new Error(`Context storage operation failed: ${message}`),
  );
});
