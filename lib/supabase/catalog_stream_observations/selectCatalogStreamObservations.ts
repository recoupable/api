import supabase from "../serverClient";
/** Read latest saved source versions through bounded, nonoverlapping SQL windows. */
export async function selectCatalogStreamObservations(input: {
  catalogId: string;
  isrc: string;
  since: string;
  until: string;
}) {
  const day = 86_400_000;
  const start = Date.parse(`${input.since}T00:00:00Z`);
  const end = Date.parse(`${input.until}T00:00:00Z`);
  const span = (end - start) / day;
  if (!Number.isInteger(span) || span < 1 || span > 732)
    throw new Error("Invalid catalog stream history range");
  // SQL selects one latest source version per day and accepts at most 62 days. Each response
  // stays below PostgREST's row cap; two 366-day comparison periods need at most 12 reads.
  const observations = [];
  for (let boundary = start; boundary < end; boundary += 62 * day) {
    const { data, error } = await supabase.rpc("read_catalog_stream_days", {
      p_catalog_id: input.catalogId,
      p_isrc: input.isrc,
      p_since: new Date(boundary).toISOString().slice(0, 10),
      p_until: new Date(Math.min(boundary + 62 * day, end)).toISOString().slice(0, 10),
    });
    if (error) throw new Error("Catalog stream history unavailable");
    observations.push(...(data ?? []));
  }
  return observations;
}
