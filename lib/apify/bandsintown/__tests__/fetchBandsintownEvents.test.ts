import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBandsintownEvents } from "../fetchBandsintownEvents";

import apifyClient from "@/lib/apify/client";

vi.mock("@/lib/apify/client", () => {
  return { default: { actor: vi.fn(), dataset: vi.fn() } };
});

/** Shape mirrors a real `hoholabs~bandsintown-scraper` dataset item. */
const ITEMS = [
  {
    id: "108011396",
    url: "https://www.bandsintown.com/e/108011396",
    datetime: "2026-09-26T19:00:00",
    starts_at: "2026-09-26T19:00:00",
    venue: {
      name: "O2 Academy Brixton",
      city: "London",
      region: "",
      country: "United Kingdom",
    },
    lineup: ["Loreen"],
    offers: [
      { type: "Tickets", url: "https://www.bandsintown.com/t/108011396", status: "available" },
    ],
    sold_out: false,
  },
  {
    id: "108588912",
    url: "https://www.bandsintown.com/e/108588912",
    datetime: "2026-09-10T19:30:00",
    starts_at: "2026-09-10T19:30:00",
    venue: {
      name: "St Pancras Old Church",
      city: "London",
      region: "",
      country: "United Kingdom",
    },
    lineup: ["Jake Isaac", "Support Act"],
    offers: [],
    sold_out: true,
  },
];

function mockRun(items: unknown[], status = "SUCCEEDED") {
  const call = vi.fn().mockResolvedValue({ id: "run_1", defaultDatasetId: "ds_1", status });
  vi.mocked(apifyClient.actor).mockReturnValue({ call } as never);
  const listItems = vi.fn().mockResolvedValue({ items });
  vi.mocked(apifyClient.dataset).mockReturnValue({ listItems } as never);
  return { call, listItems };
}

describe("fetchBandsintownEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the actor with the artist id and returns normalized events", async () => {
    const { call } = mockRun(ITEMS);

    const events = await fetchBandsintownEvents({ bandsintownId: "1590132" });

    expect(apifyClient.actor).toHaveBeenCalledWith("hoholabs~bandsintown-scraper");
    expect(call).toHaveBeenCalledWith({
      queryType: "events",
      artistId: "1590132",
      date: "upcoming",
    });
    expect(apifyClient.dataset).toHaveBeenCalledWith("ds_1");
    expect(events).toEqual([
      {
        date: "2026-09-10",
        venue: "St Pancras Old Church",
        city: "London",
        region: "",
        country: "United Kingdom",
        ticket_url: null,
        sold_out: true,
        lineup: ["Jake Isaac", "Support Act"],
      },
      {
        date: "2026-09-26",
        venue: "O2 Academy Brixton",
        city: "London",
        region: "",
        country: "United Kingdom",
        ticket_url: "https://www.bandsintown.com/t/108011396",
        sold_out: false,
        lineup: ["Loreen"],
      },
    ]);
  });

  it("sorts events ascending by date", async () => {
    mockRun(ITEMS);

    const events = await fetchBandsintownEvents({ bandsintownId: "1590132" });

    expect(events.map(e => e.date)).toEqual(["2026-09-10", "2026-09-26"]);
  });

  it("forwards the date filter when provided", async () => {
    const { call } = mockRun([]);

    await fetchBandsintownEvents({ bandsintownId: "66728", date: "past" });

    expect(call).toHaveBeenCalledWith({
      queryType: "events",
      artistId: "66728",
      date: "past",
    });
  });

  it("returns an empty array when the artist has no events (not an error)", async () => {
    mockRun([]);

    await expect(fetchBandsintownEvents({ bandsintownId: "66728" })).resolves.toEqual([]);
  });

  it("throws when the actor run does not succeed", async () => {
    mockRun(ITEMS, "FAILED");

    await expect(fetchBandsintownEvents({ bandsintownId: "1590132" })).rejects.toThrow(/FAILED/);
  });
});
