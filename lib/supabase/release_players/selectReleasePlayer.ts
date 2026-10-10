import { playerDatabase } from "./playerDatabase";
import type { ReleasePlayer } from "@/lib/players/schema";
export async function selectReleasePlayer(id: string): Promise<ReleasePlayer | null> {
  const { data, error } = await playerDatabase()
    .from("release_players")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not read player");
  return data;
}
