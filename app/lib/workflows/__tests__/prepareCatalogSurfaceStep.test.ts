import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { prepareCatalogSurface } from "@/lib/intelligent-ui/prepareCatalogSurface";
import { prepareCatalogSurfaceStep } from "../prepareCatalogSurfaceStep";
vi.mock("@/lib/intelligent-ui/prepareCatalogSurface", () => ({ prepareCatalogSurface: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());
it("rejects even direct Workflow input in production before a saved read", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(prepareCatalogSurfaceStep({} as never)).rejects.toThrow("development-only");
  expect(prepareCatalogSurface).not.toHaveBeenCalled();
});
it("retains the explicit App reporting window and applies only existing page/limit defaults", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const selection = {
    workspaceId: "00000000-0000-4000-8000-000000000001",
    query: { catalog_id: "00000000-0000-4000-8000-000000000003", since: "2026-09-02", days: 7 },
  };
  await prepareCatalogSurfaceStep({
    accountId: "actor",
    assistantMessageId: "message",
    ...selection,
  });
  expect(prepareCatalogSurface).toHaveBeenCalledWith({
    accountId: "actor",
    assistantMessageId: "message",
    ...selection,
    query: { ...selection.query, page: 1, limit: 25 },
  });
});
