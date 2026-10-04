import supabase from "./serverClient";

/**
 * Fetches a single memory by its ID.
 *
 * @param params - Object containing the memory ID
 * @returns The memory record or null
 */
export async function getMemoryById({ id }: { id: string }) {
  try {
    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Failed to get memory by id:", error.message);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Failed to get memory by id from database");
    throw error;
  }
}
