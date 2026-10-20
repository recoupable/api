import supabase from "../serverClient";
import { SUPABASE_STORAGE_BUCKET } from "@/lib/const";
/** Single-object private upload capability; never forwards or returns account OAuth credentials. */
export async function createPackSignedUpload(storageKey: string) {
  const { data, error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUploadUrl(storageKey);
  if (error || !data) throw new Error("Could not prepare private media upload");
  return {
    storage_key: storageKey,
    signed_upload_url: data.signedUrl,
    upload_token: data.token,
    expires_in_seconds: 7200,
  };
}
