import { fanConnectionDatabase } from "../site_fan_connections/fanConnectionDatabase";
export async function takeSiteRequest(key: string, limit: number) {
  const { data, error } = await fanConnectionDatabase().rpc("take_site_request", {
    p_key: key,
    p_limit: limit,
  });
  if (error) throw new Error("Could not check site request limit");
  return data === true;
}
