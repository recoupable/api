import { z } from "zod";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import type { PackActor } from "./packTypes";
import type { ReleasePackBrief } from "./releasePackSchema";
/** Reuse a private saved evidence snapshot without writing a second artist/catalog graph. */
export async function loadPackContextBrief(
  actor: PackActor,
  brief: ReleasePackBrief,
): Promise<ReleasePackBrief> {
  if (!brief.context_brief_id) return brief;
  const snapshot = z
    .object({
      id: z.uuid(),
      state: z.literal("saved"),
      superseded: z.literal(false),
      purpose: z.literal("creative_direction"),
      brief: z.object({
        documents: z.array(
          z.object({
            ownerId: z.uuid(),
            status: z.literal("accepted"),
            topic: z.string(),
            text: z.string().max(32000),
            version: z.number(),
            sourceVersionIds: z.array(z.uuid()),
          }),
        ),
      }),
    })
    .parse(
      await callContextRpc("read_context_brief", {
        p_owner: actor.organizationId ?? actor.accountId,
        p_brief: brief.context_brief_id,
      }),
    );
  const owner = actor.organizationId ?? actor.accountId;
  const documents = snapshot.brief.documents.filter(
    doc =>
      doc.ownerId === owner &&
      ["song_summary", "artwork_branding", "artist_research"].includes(doc.topic),
  );
  const summary = documents
    .filter(doc => doc.topic === "song_summary")
    .map(doc => doc.text)
    .join("\n")
    .slice(0, 1800);
  const direction = documents
    .filter(doc => doc.topic === "artwork_branding")
    .map(doc => doc.text)
    .join("\n")
    .slice(0, 1800);
  return {
    ...brief,
    song_summary: brief.song_summary ?? (summary || undefined),
    creative_direction: brief.creative_direction ?? (direction || undefined),
    evidence: [
      ...brief.evidence,
      ...documents.slice(0, Math.max(0, 20 - brief.evidence.length)).map(doc => ({
        text: `Saved ${doc.topic} v${doc.version}: ${doc.text}`.slice(0, 2000),
        kind: "source_observation" as const,
      })),
    ],
  };
}
