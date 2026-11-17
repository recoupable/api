import { afterEach, describe, expect, it, vi } from "vitest";
import { limitIngestionRequest } from "../limitIngestionRequest";
import { takeSiteRequest } from "@/lib/supabase/site_activity_events/takeSiteRequest";
vi.mock("@/lib/supabase/site_activity_events/takeSiteRequest", () => ({
  takeSiteRequest: vi.fn(),
}));
describe("durable ingestion request limits", () => {
  afterEach(() => vi.resetAllMocks());
  it("uses separate private per-actor/scope operation counters", async () => {
    vi.mocked(takeSiteRequest).mockResolvedValue(true);
    await limitIngestionRequest("actor", "account/owner", "create");
    await limitIngestionRequest("actor", "account/owner", "read");
    const calls = vi.mocked(takeSiteRequest).mock.calls;
    expect(calls[0][0]).toMatch(/^[a-f0-9]{64}$/);
    expect(calls[0][0]).not.toBe(calls[1][0]);
    expect(calls[0][1]).toBe(10);
  });
  it("fails closed when the counter denies a request", async () => {
    vi.mocked(takeSiteRequest).mockResolvedValue(false);
    await expect(limitIngestionRequest("actor", "account/owner", "create")).rejects.toThrow(
      "Ingestion request limit reached",
    );
  });
});
