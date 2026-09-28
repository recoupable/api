import { fanConnectionDatabase } from "./fanConnectionDatabase";
export async function selectSiteFans(siteId: string, offset: number, limit: number) {
  const { data, error, count } = await fanConnectionDatabase()
    .from("site_fans")
    .select(
      "id,site_id,spotify_id,display_name,email,first_connected_at,last_connected_at,site_fan_connections(connected_at,site_fan_permissions(scopes,granted_at),site_fan_marketing_consents(consent_text,config_revision,accepted_at))",
      { count: "exact" },
    )
    .eq("site_id", siteId)
    .order("last_connected_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error("Could not load site fans");
  return { fans: data ?? [], total: count ?? 0, offset, limit };
}
