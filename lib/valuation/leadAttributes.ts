import type { ValuationLeadInput } from "@/lib/valuation/valuationLeadInput";

/**
 * Build the Attio Person attribute values for a valuation lead — the *latest*
 * run's snapshot (the qualifying data sales sorts/filters on). `est_catalog_value`
 * is the band's central estimate, i.e. the lead score.
 */
export function leadAttributes(lead: ValuationLeadInput, today: string): Record<string, unknown> {
  const values: Record<string, unknown> = {
    email_addresses: [{ email_address: lead.email }],
    lead_source: "Catalog Valuation",
    // Whole dollars — Attio's currency attribute rejects >4 decimal places, and
    // the real valuation band is fractional.
    est_catalog_value: Math.round(lead.valueBand.central),
    looked_up_artist: lead.artistName,
    spotify_artist_url: `https://open.spotify.com/artist/${lead.artistId}`,
    valued_at: today,
  };
  if (typeof lead.lifetimeStreams === "number") values.lifetime_streams = lead.lifetimeStreams;
  if (typeof lead.followerCount === "number") values.follower_count = lead.followerCount;
  return values;
}
