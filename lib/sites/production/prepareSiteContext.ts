import { z } from "zod";
import { processContextOperation } from "@/lib/context/processContextOperation";
import { runStoredContextRequest } from "@/lib/context/runStoredContextRequest";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { authorizeSiteWorkspace } from "../authorizeSiteWorkspace";
import type { Site } from "../schema";
/** Creates/reuses one saved metadata request per site; subsequent modules use its recording identity. */
export async function prepareSiteContext(site: Site, accountId: string, albumTrack = false) {
  await authorizeSiteWorkspace(accountId, site.owner_id);
  const result = await processContextOperation(
    accountId,
    {
      action: "ingest",
      url: site.release_url,
      organization_id: site.owner_id,
      idempotency_key: albumTrack
        ? `sites:${site.id}:track:${new URL(site.release_url).pathname.split("/").at(-1)}:context-v1`
        : `sites:${site.id}:context-v1`,
    },
    { rpc: callContextRpc, dispatch: runStoredContextRequest },
  );
  const requestId = z.object({ request: z.object({ id: z.uuid() }) }).parse(result).request.id;
  const docs = z
    .array(z.object({ topic: z.string(), subjectId: z.uuid(), text: z.string() }))
    .parse(
      await callContextRpc("read_context_documents", {
        p_owner: site.owner_id,
        p_request: requestId,
      }),
    );
  const recording = docs.find(d => d.topic === "recording_metadata");
  const release = docs.find(d => d.topic === "release_metadata");
  if (!recording || !release) throw new Error("Recording metadata is not ready");
  const metadata = z
    .object({
      trackId: z.string(),
      title: z.string(),
      isrc: z.string(),
      durationSeconds: z.number(),
      artists: z.array(z.object({ name: z.string() })),
      previewUrl: z.string().nullable().optional(),
    })
    .parse(JSON.parse(recording.text));
  const album = z
    .object({
      date: z.string().nullable().optional(),
      artwork: z.array(z.object({ url: z.string() })),
    })
    .parse(JSON.parse(release.text));
  return {
    requestId,
    subjectId: recording.subjectId,
    metadata,
    release: {
      url: `https://open.spotify.com/track/${metadata.trackId}`,
      title: metadata.title,
      artists: metadata.artists.map(a => a.name),
      isrc: metadata.isrc,
      date: album.date ?? null,
      artwork: album.artwork[0]?.url ?? null,
      previewUrl: metadata.previewUrl ?? null,
    },
  };
}
