import { afterEach, expect, it, vi } from "vitest";
import { retainCatalogSnapshotStep } from "@/app/lib/workflows/retainCatalogSnapshotStep";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/catalog_surface_sources/retainCatalogSurfaceSource", () => ({
  retainCatalogSurfaceSource: rpc,
}));
afterEach(() => vi.unstubAllEnvs());
it("default-off never opens a database import or read", async () => {
  vi.stubEnv("CATALOG_SURFACE_RETENTION_ENABLED", "false");
  expect(await retainCatalogSnapshotStep(undefined, {} as never, {})).toEqual({
    state: "not-enabled",
  });
  expect(rpc).not.toHaveBeenCalled();
});
it("enabled production is refused", async () => {
  vi.stubEnv("CATALOG_SURFACE_RETENTION_ENABLED", "true");
  vi.stubEnv("NODE_ENV", "production");
  await expect(retainCatalogSnapshotStep(undefined, {} as never, {})).rejects.toThrow(
    "development-only",
  );
  expect(rpc).not.toHaveBeenCalled();
});
it("enabled development without fenced writer is refused without RPC", async () => {
  vi.stubEnv("CATALOG_SURFACE_RETENTION_ENABLED", "true");
  vi.stubEnv("NODE_ENV", "development");
  await expect(retainCatalogSnapshotStep(undefined, {} as never, {})).rejects.toThrow(
    "no automatic retry",
  );
  expect(rpc).not.toHaveBeenCalled();
});
