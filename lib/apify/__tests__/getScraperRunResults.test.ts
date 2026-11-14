import { describe, it, expect, vi, beforeEach } from "vitest";
import apifyClient from "@/lib/apify/client";
import { getScraperRunResults } from "../getScraperRunResults";

vi.mock("@/lib/apify/client", () => ({ default: { run: vi.fn(), dataset: vi.fn() } }));

const mockRun = (run: unknown) =>
  vi.mocked(apifyClient.run).mockReturnValue({ get: vi.fn().mockResolvedValue(run) } as never);
const mockItems = (items: unknown) =>
  vi
    .mocked(apifyClient.dataset)
    .mockReturnValue({ listItems: vi.fn().mockResolvedValue({ items }) } as never);

describe("getScraperRunResults", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns dataset items for a SUCCEEDED run", async () => {
    mockRun({ status: "SUCCEEDED", defaultDatasetId: "d1" });
    mockItems([{ a: 1 }]);
    expect(await getScraperRunResults("r1")).toEqual({
      status: "SUCCEEDED",
      dataset_id: "d1",
      data: [{ a: 1 }],
    });
    expect(apifyClient.run).toHaveBeenCalledWith("r1");
    expect(apifyClient.dataset).toHaveBeenCalledWith("d1");
  });

  it("returns only the status for a run still in progress", async () => {
    mockRun({ status: "RUNNING", defaultDatasetId: "d1" });
    expect(await getScraperRunResults("r1")).toEqual({ status: "RUNNING", dataset_id: "d1" });
    expect(apifyClient.dataset).not.toHaveBeenCalled();
  });

  it("reports UNKNOWN when the run is missing", async () => {
    mockRun(undefined);
    expect(await getScraperRunResults("r1")).toEqual({ status: "UNKNOWN", dataset_id: null });
  });
});
