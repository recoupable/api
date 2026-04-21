import { describe, it, expect, vi, beforeEach } from "vitest";

import { getActorStatus } from "../getActorStatus";
import apifyClient from "@/lib/apify/client";

vi.mock("@/lib/apify/client", () => ({
  default: { run: vi.fn() },
}));

const getMock = vi.fn();
vi.mocked(apifyClient.run).mockImplementation(() => ({ get: getMock }) as never);

describe("getActorStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apifyClient.run).mockImplementation(() => ({ get: getMock }) as never);
  });

  it("projects defaultDatasetId to dataset_id", async () => {
    getMock.mockResolvedValue({ status: "SUCCEEDED", defaultDatasetId: "ds_1" });
    expect(await getActorStatus("run_1")).toEqual({
      status: "SUCCEEDED",
      dataset_id: "ds_1",
    });
  });

  it("returns null dataset_id when defaultDatasetId missing", async () => {
    getMock.mockResolvedValue({ status: "RUNNING" });
    expect(await getActorStatus("run_1")).toEqual({ status: "RUNNING", dataset_id: null });
  });

  it("propagates thrown errors", async () => {
    getMock.mockRejectedValue(new Error("boom"));
    await expect(getActorStatus("run_1")).rejects.toThrow("boom");
  });
});
