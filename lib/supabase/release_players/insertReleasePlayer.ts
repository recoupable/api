import { playerDatabase } from "./playerDatabase";
import type { ReleasePlayer } from "@/lib/players/schema";
export async function insertReleasePlayer(
  input: Omit<ReleasePlayer, "id" | "revision"> & { created_by: string },
): Promise<ReleasePlayer> {
  const { data, error } = await playerDatabase()
    .from("release_players")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error("Could not create player");
  return data;
}
