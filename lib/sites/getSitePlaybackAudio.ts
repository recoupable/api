import { z } from "zod";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { createSignedFileUrlByKey } from "@/lib/supabase/storage/createSignedFileUrlByKey";
import type { Site } from "./schema";

/** Publish a short-lived link only to the verified recording of this published site. */
export async function getSitePlaybackAudio(site: Site): Promise<string | null> {
  const published = site.published;
  const requestId = published?.production?.context.engine?.requestIds[0];
  if (!published || !requestId) return null;
  try {
    const documents = z
      .array(z.object({ topic: z.string(), status: z.string(), text: z.string() }))
      .parse(
        await callContextRpc("read_context_documents", {
          p_owner: site.owner_id,
          p_request: requestId,
        }),
      );
    const trackId = (url: string) =>
      new URL(url).pathname.match(/^\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]{22})\/?$/)?.[1];
    const releaseId = trackId(published.releaseUrl);
    if (!releaseId) return null;
    for (const document of documents) {
      if (document.topic !== "audio_source" || document.status !== "accepted") continue;
      const asset = z
        .object({
          spotifyUrl: z.string().url(),
          storage: z.object({ bucket: z.literal("user-files"), key: z.string() }),
        })
        .safeParse(JSON.parse(document.text));
      if (!asset.success) continue;
      const { spotifyUrl, storage } = asset.data;
      if (new URL(spotifyUrl).hostname !== "open.spotify.com" || trackId(spotifyUrl) !== releaseId)
        continue;
      if (
        !storage.key.startsWith(`${site.owner_id}/context-audio/`) ||
        !/^[a-zA-Z0-9/-]+\.wav$/.test(storage.key)
      )
        continue;
      return await createSignedFileUrlByKey({ key: storage.key, expiresInSeconds: 3600 });
    }
  } catch {
    // Audio availability must not prevent the published game from opening.
  }
  return null;
}
