import { createClient } from "@supabase/supabase-js";
/** Scoped service SDK request; never change the shared client's fetch or credentials. */
export async function getContextOriginalDownload(key: string, signal: AbortSignal) {
  const url = process.env.SUPABASE_URL,
    credential = process.env.SUPABASE_KEY;
  if (!url || !credential) throw new Error("Private original unavailable");
  const client = createClient(url, credential, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, options) => fetch(input, { ...options, signal }) },
  });
  return client.storage.from("context-private").download(key).asStream();
}
