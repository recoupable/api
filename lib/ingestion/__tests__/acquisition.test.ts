import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acquireIngestionSource } from "../acquireIngestionSource";
const scope = "account/11111111-1111-4111-8111-111111111111";
describe("configured API source acquisition", () => {
  beforeEach(() => {
    vi.stubEnv(
      "INGESTION_SOURCES_JSON",
      JSON.stringify([
        {
          id: "report",
          scope,
          url: "https://reports.example.com/export",
          token_env: "INGESTION_SOURCE_REPORTS",
        },
      ]),
    );
    vi.stubEnv("INGESTION_SOURCE_REPORTS", "private-token");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("captures exact response bytes and sends credentials only to configured HTTPS sources", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('[{"id":9007199254740993}]'));
    vi.stubGlobal("fetch", fetcher);
    const result = await acquireIngestionSource(scope, "report");
    expect(Buffer.from(result.bytes).toString()).toBe('[{"id":9007199254740993}]');
    expect(fetcher.mock.calls[0][0]).toBe("https://reports.example.com/export");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      cache: "no-store",
      headers: { Authorization: "Bearer private-token" },
    });
  });
  it("rejects a connector outside the current scope before contacting it", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      acquireIngestionSource("account/22222222-2222-4222-8222-222222222222", "report"),
    ).rejects.toThrow("Source connector unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("bounds chunked sources without trusting Content-Length", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("x".repeat(2 * 1024 * 1024 + 1))),
    );
    await expect(acquireIngestionSource(scope, "report")).rejects.toThrow("Source size limit");
  });
  it("rejects malformed server URLs as configuration errors without fetching", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv(
      "INGESTION_SOURCES_JSON",
      JSON.stringify([{ id: "report", scope, url: "invalid-url" }]),
    );
    await expect(acquireIngestionSource(scope, "report")).rejects.toThrow(
      "Source connector configuration invalid",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("refuses unconfigured credentials and non-HTTPS connectors", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv("INGESTION_SOURCE_REPORTS", "");
    await expect(acquireIngestionSource(scope, "report")).rejects.toThrow();
    vi.stubEnv(
      "INGESTION_SOURCES_JSON",
      JSON.stringify([{ id: "report", scope, url: "http://localhost/export" }]),
    );
    await expect(acquireIngestionSource(scope, "report")).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
