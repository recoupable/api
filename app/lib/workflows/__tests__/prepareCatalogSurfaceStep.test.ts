import { afterEach, expect, it, vi } from "vitest";
import { prepareCatalogSurface } from "@/lib/intelligent-ui/prepareCatalogSurface";
import { prepareCatalogSurfaceStep } from "../prepareCatalogSurfaceStep";
vi.mock("@/lib/intelligent-ui/prepareCatalogSurface", () => ({ prepareCatalogSurface: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it("rejects even direct Workflow input in production before a saved read", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(prepareCatalogSurfaceStep({} as never)).rejects.toThrow("development-only");
  expect(prepareCatalogSurface).not.toHaveBeenCalled();
});

it("chooses the first page and last 28 completed UTC days for the App context", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-24T12:30:00Z"));
  try {
    await prepareCatalogSurfaceStep({
      accountId: "actor",
      assistantMessageId: "message",
      context: {
        schemaVersion: 1,
        workspace: { kind: "account", id: "00000000-0000-4000-8000-000000000001" },
        subject: { kind: "catalog", id: "00000000-0000-4000-8000-000000000003" },
      },
    });
  } catch (error) {
    expect((error as Error).message).toBe("Catalog not found");
  }
  expect(prepareCatalogSurface).not.toHaveBeenCalled();
  const actor = "00000000-0000-4000-8000-000000000001";
  await prepareCatalogSurfaceStep({
    accountId: actor,
    assistantMessageId: "message",
    context: {
      schemaVersion: 1,
      workspace: { kind: "account", id: actor },
      subject: { kind: "catalog", id: "00000000-0000-4000-8000-000000000003" },
    },
  });
  expect(prepareCatalogSurface).toHaveBeenCalledWith({
    accountId: actor,
    workspaceId: actor,
    assistantMessageId: "message",
    query: {
      catalog_id: "00000000-0000-4000-8000-000000000003",
      since: "2026-09-26",
      days: 28,
      page: 1,
      limit: 25,
    },
  });
  vi.useRealTimers();
});
