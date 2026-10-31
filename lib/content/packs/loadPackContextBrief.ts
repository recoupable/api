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
            id: z.uuid(),
            ownerId: z.uuid(),
            subjectId: z.uuid(),
            status: z.literal("accepted"),
            evidenceKind: z.enum([
              "observation",
              "estimate",
              "interpretation",
              "customer_assertion",
            ]),
            coverage: z.enum(["full", "partial"]),
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
      doc.text.trim().length > 0 &&
      ["song_summary", "artwork_branding", "artist_research"].includes(doc.topic),
  );
  const attributed = documents.map(doc => {
    const attribution = `Saved Context brief ${snapshot.id}, document ${doc.id}, subject ${doc.subjectId}, ${doc.topic} v${doc.version}; evidence: ${doc.evidenceKind}; coverage: ${doc.coverage}.`;
    const completeText = `${attribution}\n${doc.text}`;
    const fits = completeText.length <= 2000;
    return {
      topic: doc.topic,
      completeText: fits ? completeText : undefined,
      evidence: {
        text: fits
          ? completeText
          : `${attribution}\nDocument text omitted because it exceeds the pack evidence limit. Read the complete document in this saved Context brief before using its claims.`,
        kind:
          doc.evidenceKind === "customer_assertion"
            ? ("customer_assertion" as const)
            : ("source_observation" as const),
      },
    };
  });
  // A saved Context brief can cover multiple recordings or releases. Do not
  // collapse their separate claims into this pack's one song or visual world.
  const singleTopicText = (topic: string) => {
    const matching = attributed.filter(item => item.topic === topic);
    return matching.length === 1 ? matching[0].completeText : undefined;
  };
  const additions = attributed
    .map(item => item.evidence)
    .filter(
      item =>
        !brief.evidence.some(
          existing => existing.kind === item.kind && existing.text === item.text,
        ),
    );
  return {
    ...brief,
    song_summary: brief.song_summary ?? singleTopicText("song_summary"),
    creative_direction: brief.creative_direction ?? singleTopicText("artwork_branding"),
    evidence: [...brief.evidence, ...additions.slice(0, Math.max(0, 20 - brief.evidence.length))],
  };
}
