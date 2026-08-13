import apifyClient from "@/lib/apify/client";

const BANDSINTOWN_ACTOR = "hoholabs~bandsintown-scraper";

export type BandsintownDateFilter = "upcoming" | "past" | "all";

export type BandsintownEvent = {
  date: string;
  venue: string;
  city: string;
  region: string;
  country: string;
  ticket_url: string | null;
  sold_out: boolean;
  lineup: string[];
};

type RawEvent = {
  datetime?: string;
  starts_at?: string;
  venue?: { name?: string; city?: string; region?: string; country?: string };
  lineup?: string[];
  offers?: Array<{ url?: string }>;
  sold_out?: boolean;
};

/**
 * Fetch an artist's live events from Bandsintown, keyed on the artist's
 * numeric Bandsintown id.
 *
 * The id is what makes this safe: looking shows up by artist *name* can return
 * a different, more search-prominent performer who shares that name. Passing an
 * id removes the resolution step entirely, so the result set cannot drift to
 * the wrong artist.
 *
 * Runs the actor synchronously — this is a read-only fetch whose caller needs
 * the data in its response, matching {@link fetchSpotifyAlbumPlayCounts} rather
 * than the `.start()` + webhook scrapers, which persist results and fan out.
 * Measured p95 is ~6s against a 60s route budget.
 *
 * @param params - Lookup parameters
 * @param params.bandsintownId - Numeric Bandsintown artist id
 * @param params.date - Which events to return; defaults to `upcoming`
 * @returns Normalized events, ascending by date. Empty when the artist has none
 * @throws Error when the actor run does not reach SUCCEEDED
 */
export async function fetchBandsintownEvents({
  bandsintownId,
  date = "upcoming",
}: {
  bandsintownId: string;
  date?: BandsintownDateFilter;
}): Promise<BandsintownEvent[]> {
  const run = await apifyClient.actor(BANDSINTOWN_ACTOR).call({
    queryType: "events",
    artistId: bandsintownId,
    date,
  });

  if (!run?.defaultDatasetId || run.status !== "SUCCEEDED") {
    throw new Error(`Bandsintown actor run failed with status ${run?.status}`);
  }

  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  return (items as RawEvent[])
    .map(normalizeEvent)
    .filter((event): event is BandsintownEvent => event !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Reduce a raw dataset item to the documented event shape, dropping rows with
 * no usable date so a malformed item can't surface as an undated event.
 *
 * @param raw - One dataset item from the actor run
 * @returns The normalized event, or null when it carries no date
 */
function normalizeEvent(raw: RawEvent): BandsintownEvent | null {
  const date = (raw.datetime ?? raw.starts_at ?? "").slice(0, 10);
  if (!date) return null;

  return {
    date,
    venue: raw.venue?.name ?? "",
    city: raw.venue?.city ?? "",
    region: raw.venue?.region ?? "",
    country: raw.venue?.country ?? "",
    ticket_url: raw.offers?.[0]?.url ?? null,
    sold_out: Boolean(raw.sold_out),
    lineup: raw.lineup ?? [],
  };
}
