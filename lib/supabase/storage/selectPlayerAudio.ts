import supabase from "@/lib/supabase/serverClient";
/** Verify the exact object and audio metadata without fetching arbitrary external URLs. */
export async function selectPlayerAudio(owner: string, value: string): Promise<boolean> {
  const base = process.env.SUPABASE_URL;
  if (!base) return false;
  const prefix = `${base.replace(/\/$/, "")}/storage/v1/object/public/site-assets/${owner}/`;
  if (!value.startsWith(prefix)) return false;
  const name = value.slice(prefix.length);
  if (!/^[0-9a-f-]{36}\.(mp3|wav)$/.test(name)) return false;
  const { data, error } = await supabase.storage
    .from("site-assets")
    .list(owner, { search: name, limit: 100 });
  if (error) return false;
  return !!data?.some(
    file =>
      file.name === name &&
      ["audio/mpeg", "audio/wav", "audio/x-wav"].includes(file.metadata?.mimetype),
  );
}
