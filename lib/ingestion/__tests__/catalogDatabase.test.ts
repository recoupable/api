import { beforeEach, describe, expect, it, vi } from "vitest";
import { getIngestionCatalogResult } from "@/lib/supabase/ingestion_imports/getIngestionCatalogResult";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
describe("shared ingestion database gateway", () => {
  beforeEach(() => vi.clearAllMocks());
  it("passes the authenticated actor and organization to the guarded RPC", async () => {
    rpc.mockResolvedValue({ data: { datasets: [], next_after: null }, error: null });
    expect(
      await getIngestionCatalogResult("actor", "organization", "datasets", { limit: 10 }),
    ).toEqual({ datasets: [], next_after: null });
    expect(rpc).toHaveBeenCalledWith("ingestion_catalog_command", {
      p_actor: "actor",
      p_org: "organization",
      p_action: "datasets",
      p_input: { limit: 10 },
    });
  });
  it("classifies denied database membership without exposing database errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "secret details" } });
    await expect(
      getIngestionCatalogResult("actor", "organization", "datasets", {}),
    ).rejects.toThrow("Access denied");
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Ingestion catalog conflict" },
    });
    await expect(
      getIngestionCatalogResult("actor", "organization", "datasets", {}),
    ).rejects.toThrow("Ingestion catalog conflict");
  });
  it("fails closed on unavailable or malformed database responses", async () => {
    for (const response of [
      { data: null, error: { code: "42P01", message: "private table" } },
      { data: null, error: null },
      { data: [], error: null },
    ]) {
      rpc.mockResolvedValue(response);
      await expect(
        getIngestionCatalogResult("actor", "organization", "datasets", {}),
      ).rejects.toThrow("Ingestion catalog unavailable");
    }
  });
});
