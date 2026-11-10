import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTriggerRuns } from "../fetchTriggerRuns";

describe("fetchTriggerRuns", () => {
  beforeEach(() => {
    vi.stubEnv("TRIGGER_SECRET_KEY", "tr_test");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [{ id: "run_1" }] }),
    }) as unknown as typeof fetch;
  });

  it("lists one task's runs created inside a time window", async () => {
    const runs = await fetchTriggerRuns(
      {
        "filter[taskIdentifier]": "customer-prompt-task",
        "filter[createdAt][from]": "2026-11-06T10:00:00.000Z",
        "filter[createdAt][to]": "2026-11-06T11:00:00.000Z",
      },
      100,
    );

    expect(runs).toEqual([{ id: "run_1" }]);
    const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
    expect(url.searchParams.get("filter[taskIdentifier]")).toBe("customer-prompt-task");
    expect(url.searchParams.get("filter[createdAt][from]")).toBe("2026-11-06T10:00:00.000Z");
    expect(url.searchParams.get("filter[createdAt][to]")).toBe("2026-11-06T11:00:00.000Z");
    expect(url.searchParams.get("page[size]")).toBe("100");
  });
});
