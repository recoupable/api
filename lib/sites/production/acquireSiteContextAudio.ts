import { randomUUID } from "node:crypto";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { uploadFileByKey } from "@/lib/supabase/storage/uploadFileByKey";
import { collectContextAudioSource } from "@/lib/context/enrichment/collectContextAudioSource";
import { acquireVerifiedAudioInSandbox } from "@/lib/context/audio/acquireVerifiedAudioInSandbox";
import { authorizeSiteWorkspace } from "../authorizeSiteWorkspace";
import type { Site } from "../schema";
import type { prepareSiteContext } from "./prepareSiteContext";
/** Use saved verified audio or run bounded hosted acquisition; never fall back to a preview as full audio. */
export async function acquireSiteContextAudio(
  site: Site,
  accountId: string,
  context: Awaited<ReturnType<typeof prepareSiteContext>>,
) {
  await authorizeSiteWorkspace(accountId, site.owner_id);
  const docs = (await callContextRpc("read_context_documents", {
    p_owner: site.owner_id,
    p_request: context.requestId,
  })) as { topic: string; status: string; subjectId: string }[];
  if (
    docs.some(
      d =>
        d.topic === "audio_source" && d.status === "accepted" && d.subjectId === context.subjectId,
    )
  )
    return;
  if (!context.metadata.previewUrl)
    throw new Error("Spotify preview unavailable for recording verification");
  const audio = await acquireVerifiedAudioInSandbox({
    title: context.metadata.title,
    artists: context.release.artists,
    durationSeconds: context.metadata.durationSeconds,
    previewUrl: context.metadata.previewUrl,
  });
  await authorizeSiteWorkspace(accountId, site.owner_id);
  const key = `${site.owner_id}/context-audio/${randomUUID()}.wav`;
  await uploadFileByKey(key, new Blob([new Uint8Array(audio.file)]), {
    contentType: "audio/wav",
    upsert: false,
  });
  return collectContextAudioSource(
    accountId,
    site.owner_id,
    context.requestId,
    {
      recordingSubjectId: context.subjectId,
      isrc: context.metadata.isrc,
      spotifyUrl: context.release.url,
      youtubeUrl: audio.youtubeUrl,
      storageKey: key,
      sha256: audio.sha256,
      durationSeconds: audio.durationSeconds,
      spotifyDurationSeconds: context.metadata.durationSeconds,
      verification: audio.verification,
    },
    { rpc: callContextRpc, authorize: authorizeSiteWorkspace },
  );
}
