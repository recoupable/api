import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetScraperResultsTool } from "../registerGetScraperResultsTool";
import { getScraperRunResults } from "@/lib/apify/getScraperRunResults";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/apify/getScraperRunResults", () => ({ getScraperRunResults: vi.fn() }));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));

const extra = (accountId?: string) =>
  ({
    authInfo: accountId
      ? { token: "t", clientId: accountId, scopes: [], extra: { accountId, orgId: null } }
      : undefined,
  }) as never;
const text = (result: { content: Array<{ text: string }> }) => JSON.parse(result.content[0].text);

describe("registerGetScraperResultsTool", () => {
  let config: { inputSchema: { safeParse: (v: unknown) => { success: boolean } } };
  let handler: (args: unknown, extra: unknown) => Promise<{ content: Array<{ text: string }> }>;

  beforeEach(() => {
    vi.clearAllMocks();
    const server = {
      registerTool: vi.fn((name, c, h) => {
        expect(name).toBe("get_scraper_results");
        config = c;
        handler = h;
      }),
    } as unknown as McpServer;
    registerGetScraperResultsTool(server);
  });

  it("requires a runId", () => {
    expect(config.inputSchema.safeParse({ runId: "" }).success).toBe(false);
    expect(config.inputSchema.safeParse({ runId: "abc" }).success).toBe(true);
  });

  it("returns the run status and data", async () => {
    vi.mocked(getScraperRunResults).mockResolvedValue({
      status: "SUCCEEDED",
      dataset_id: "d1",
      data: [{ url: "https://x.com/a/status/1" }],
    });
    const result = await handler({ runId: "r1" }, extra("acct"));
    expect(getScraperRunResults).toHaveBeenCalledWith("r1");
    expect(text(result)).toEqual({
      status: "SUCCEEDED",
      dataset_id: "d1",
      data: [{ url: "https://x.com/a/status/1" }],
    });
  });

  it("reports a still-running run without data", async () => {
    vi.mocked(getScraperRunResults).mockResolvedValue({ status: "RUNNING", dataset_id: "d1" });
    const result = await handler({ runId: "r1" }, extra("acct"));
    expect(text(result)).toEqual({ status: "RUNNING", dataset_id: "d1" });
  });

  it("requires authentication", async () => {
    const result = await handler({ runId: "r1" }, extra());
    expect(text(result).success).toBe(false);
    expect(getScraperRunResults).not.toHaveBeenCalled();
  });

  it("returns a redacted error when Apify fails", async () => {
    vi.mocked(getScraperRunResults).mockRejectedValue(new Error("boom"));
    const result = await handler({ runId: "r1" }, extra("acct"));
    expect(text(result)).toEqual({ success: false, message: "Failed to read the scrape run." });
  });
});
