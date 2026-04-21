import { describe, it, expect, vi, beforeEach } from "vitest";

import { getDataset } from "../getDataset";
import apifyClient from "@/lib/apify/client";

vi.mock("@/lib/apify/client", () => ({
  default: { dataset: vi.fn() },
}));

const listItemsMock = vi.fn();
vi.mocked(apifyClient.dataset).mockImplementation(() => ({ listItems: listItemsMock }) as never);

describe("getDataset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apifyClient.dataset).mockImplementation(
      () => ({ listItems: listItemsMock }) as never,
    );
  });

  it("returns items array", async () => {
    listItemsMock.mockResolvedValue({ items: [{ a: 1 }] });
    expect(await getDataset("ds_1")).toEqual([{ a: 1 }]);
  });

  it("returns null when SDK returns null", async () => {
    listItemsMock.mockResolvedValue(null);
    expect(await getDataset("ds_1")).toBeNull();
  });

  it("propagates thrown errors", async () => {
    listItemsMock.mockRejectedValue(new Error("boom"));
    await expect(getDataset("ds_1")).rejects.toThrow("boom");
  });
});
