import { playerDatabase } from "./playerDatabase";
import type { ReleasePlayer } from "@/lib/players/schema";
export async function updateReleasePlayer(
  id: string,
  owner: string,
  revision: number,
  patch: Partial<ReleasePlayer>,
): Promise<ReleasePlayer | null> {
  const { data, error } = await playerDatabase()
    .from("release_players")
    .update({ ...patch, revision: revision + 1, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", owner)
    .eq("revision", revision)
    .select("*")
    .maybeSingle();
  if (error) throw new Error("Could not update player");
  return data;
}
