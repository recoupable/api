export interface SavedContextAudioRequestDependencies<Body> {
  verifyFile?: (key: string) => Promise<{ sha256: string; durationSeconds: number }>;
  sign?: (input: { key: string; expiresInSeconds: number }) => Promise<string>;
  fetcher?: typeof fetch;
  analyze?: (input: Body) => Promise<unknown>;
}

const ANALYZE_URL = "https://api.recoupable.dev/api/songs/analyze";
const SIGNED_URL_SECONDS = 900;
const DURATION_DRIFT_SECONDS = 0.1;

/**
 * Re-verify saved private audio, sign a short-lived URL and make one production Music Flamingo
 * request. Changed bytes or duration are rejected before signing, so nothing is paid for. The
 * signed URL and API key stay inside this call and are never returned.
 *
 * @param asset - Storage key, checksum and duration recorded on the accepted `audio_source` document.
 * @param buildBody - Builds the analyze request body from the signed audio URL.
 * @param apiKey - Production API key, used only by the default HTTP caller.
 * @param deps - Optional injected file verification, signing, fetch or in-process analyze caller.
 * @returns The unvalidated provider response body and the time the provider request started.
 */
export async function requestSavedContextAudioAnalysis<Body extends { audio_url: string }>(
  asset: { storage: { key: string }; sha256: string; durationSeconds: number },
  buildBody: (audioUrl: string) => Body,
  apiKey: string,
  deps: SavedContextAudioRequestDependencies<Body>,
): Promise<{ responseBody: unknown; startedAt: number }> {
  const verify =
    deps.verifyFile ??
    (await import("@/lib/supabase/storage/getContextAudioFileMetadata"))
      .getContextAudioFileMetadata;
  const file = await verify(asset.storage.key);
  if (
    file.sha256 !== asset.sha256 ||
    Math.abs(file.durationSeconds - asset.durationSeconds) > DURATION_DRIFT_SECONDS
  )
    throw new Error("Saved audio changed");
  const sign =
    deps.sign ??
    (await import("@/lib/supabase/storage/createSignedFileUrlByKey")).createSignedFileUrlByKey;
  const url = await sign({ key: asset.storage.key, expiresInSeconds: SIGNED_URL_SECONDS });
  const startedAt = Date.now();
  const body = buildBody(url);
  if (deps.analyze) return { responseBody: await deps.analyze(body), startedAt };
  const response = await (deps.fetcher ?? fetch)(ANALYZE_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(300000),
  });
  if (!response.ok) throw new Error(`Music Flamingo failed HTTP ${response.status}`);
  return { responseBody: await response.json(), startedAt };
}
