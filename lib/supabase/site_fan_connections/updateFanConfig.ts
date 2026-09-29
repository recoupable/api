import { fanConnectionDatabase } from "./fanConnectionDatabase";
import { configSchema, type FanConfig } from "@/lib/sites/fanConnection/schema";
import { SiteError } from "@/lib/sites/SiteError";
export async function updateFanConfig(config: FanConfig, previousRevision: number) {
  const table = fanConnectionDatabase().from("site_fan_configs");
  const query =
    previousRevision === 0
      ? table.insert(config)
      : table
          .update({ ...config, updated_at: new Date().toISOString() })
          .eq("site_id", config.site_id)
          .eq("revision", previousRevision);
  const { data, error } = await query.select().maybeSingle();
  if (error?.code === "23505" || (!error && !data))
    throw new SiteError(409, "Connection settings changed. Reload before saving.");
  if (error) throw new Error("Could not save fan connection configuration");
  return configSchema.parse(data);
}
