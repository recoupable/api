import { z } from "zod";
import { collectContextSocials } from "../providers/collectContextSocials";
import { runContextEnrichment } from "./runContextEnrichment";
type Dependencies = Omit<Parameters<typeof runContextEnrichment>[4], "call"> & {
  collect?: typeof collectContextSocials;
};
/** Snapshot saved social pages together; no scraping or profile-identity confirmation. */
export async function collectContextSocialEvidence(
  actor: string,
  owner: string,
  requestId: string,
  input: { subjectId: string; collectionVersion: string; maxPages?: number },
  deps: Dependencies,
) {
  const args = z
    .strictObject({
      subjectId: z.uuid(),
      collectionVersion: z.string().min(1).max(100),
      maxPages: z.number().int().min(1).max(20).default(5),
    })
    .parse(input);
  const resolve = async () => {
    await deps.authorize(actor, owner);
    const value = await deps.rpc("resolve_context_artist", {
      p_owner: owner,
      p_request: requestId,
      p_subject: args.subjectId,
    });
    return z.object({ artistId: z.uuid() }).parse(value).artistId;
  };
  const artistId = await resolve(),
    url = `urn:recoup:artist:${artistId}:socials`;
  return runContextEnrichment(
    actor,
    owner,
    requestId,
    {
      key: "social-evidence-v1",
      topic: "social_context",
      subjectId: args.subjectId,
      provider: "recoup",
      model: "none",
      evidenceKind: "observation",
      input: { artistId, collectionVersion: args.collectionVersion, maxPages: args.maxPages },
      sources: [{ url, kind: "social", content: { artistId, role: "lookup_request" } }],
    },
    {
      ...deps,
      authorize: async () => {
        if ((await resolve()) !== artistId) throw Error("Artist identity changed");
      },
      call: async () => {
        const start = Date.now(),
          startedAt = new Date().toISOString();
        const pages: Awaited<ReturnType<typeof collectContextSocials>>[] = [];
        for (let page = 1; page <= args.maxPages; page++) {
          const result = await (deps.collect ?? collectContextSocials)(actor, artistId, page);
          if (result.artistId !== artistId || result.page !== page)
            throw Error("Social result identity or page mismatch");
          pages.push(result);
          if (!result.nextPostsPage && !result.nextProfilesPage) break;
        }
        const last = pages[pages.length - 1],
          truncated = Boolean(last.nextPostsPage || last.nextProfilesPage);
        const content = {
          artistId,
          scope: "workspace_private",
          pages,
          truncated,
          nextPage: truncated ? pages.length + 1 : null,
          gaps: [...new Set(pages.flatMap(p => p.gaps))],
          snapshotConsistency: "Pages are read separately; source may change during collection",
        };
        return {
          content,
          coverage: "partial",
          trace: {
            startedAt,
            elapsedMs: Date.now() - start,
            executor: "Recoup stored social queries",
            pages: pages.map(p => p.trace),
          },
          costUsd: null,
          costStatus: "unknown",
          observedSources: [{ url, kind: "social", content }],
        };
      },
    },
  );
}
