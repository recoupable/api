import { fanConnectionDatabase } from "./fanConnectionDatabase";
import { configSchema } from "@/lib/sites/fanConnection/schema";
export async function selectFanConfig(siteId: string) {
  const { data, error } = await fanConnectionDatabase()
    .from("site_fan_configs")
    .select("*")
    .eq("site_id", siteId)
    .maybeSingle();
  if (error) throw new Error("Could not load fan connection configuration");
  return data ? configSchema.parse(data) : null;
}
