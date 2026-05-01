import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

type Room = Tables<"rooms">;

type CreateRoomParams = Pick<Room, "account_id" | "topic" | "artist_id" | "id">;

export const upsertRoom = async (params: CreateRoomParams): Promise<Room> => {
  const { data, error } = await supabase.from("rooms").upsert(params).select("*").single();

  if (error) throw error;

  return data;
};
