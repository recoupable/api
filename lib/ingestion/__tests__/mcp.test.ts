import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { processIngestionOperation } from "../processIngestionOperation";
import { handleIngestionToolOperation } from "@/lib/mcp/tools/ingestion/handleIngestionToolOperation";
vi.mock("@/lib/mcp/resolveAccountId", () => ({ resolveAccountId: vi.fn() }));
vi.mock("../processIngestionOperation", () => ({ processIngestionOperation: vi.fn() }));
vi.mock("../createIngestionDependencies", () => ({ createIngestionDependencies: () => ({}) }));
vi.mock("../dispatchIngestionJob", () => ({ dispatchIngestionJob: vi.fn() }));
describe("ingestion MCP boundary", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("INGESTION_ENABLED", "true");
  });
  it("rejects unauthenticated calls and accepts no actor override", async () => {
    vi.mocked(resolveAccountId).mockResolvedValue({
      accountId: null,
      error: "Authentication required",
    });
    expect(
      (await handleIngestionToolOperation({ account_id: "other-account" }, {} as never)).isError,
    ).toBe(true);
    expect(vi.mocked(resolveAccountId).mock.calls[0][0].accountIdOverride).toBeUndefined();
    expect(processIngestionOperation).not.toHaveBeenCalled();
  });
  it("excludes delegated OAuth before invoking domain code", async () => {
    const extra = { authInfo: { extra: { oauth: { grantId: "grant" } } } };
    expect((await handleIngestionToolOperation({}, extra as never)).isError).toBe(true);
    expect(resolveAccountId).not.toHaveBeenCalled();
  });
  it("uses the resolved actor and the shared operation", async () => {
    vi.mocked(resolveAccountId).mockResolvedValue({ accountId: "actor", error: null });
    vi.mocked(processIngestionOperation).mockResolvedValue({ job_id: "job", status: "ready" });
    const result = await handleIngestionToolOperation({ action: "read" }, {} as never);
    expect(result.isError).not.toBe(true);
    expect(vi.mocked(processIngestionOperation).mock.calls[0][1]).toEqual({ action: "read" });
    expect(vi.mocked(processIngestionOperation).mock.calls[0][0]).toBe("actor");
  });
});
