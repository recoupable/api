import { fanConnectionDatabase } from "../site_fan_connections/fanConnectionDatabase";
import { z } from "zod";
export async function selectSiteActivity(siteId: string) {
  const { data, error } = await fanConnectionDatabase().rpc("site_activity_summary", {
    p_site_id: siteId,
  });
  if (error) throw new Error("Could not read site activity");
  return z
    .object({
      days: z.number(),
      visits: z.number(),
      starts: z.number(),
      completions: z.number(),
      replays: z.number(),
      shares: z.number(),
      signups: z.number(),
    })
    .parse(data);
}
