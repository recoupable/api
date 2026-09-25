import { z } from "zod";
const kind = z.enum([
  "artist",
  "songwriter",
  "company",
  "campaign",
  "release",
  "recording",
  "composition",
  "catalog",
  "material",
]);
const moduleId = z.enum([
  "musicbrainz",
  "mlc_recording",
  "mlc_search",
  "mlc_work",
  "songstats",
  "saved_socials",
  "catalog_valuation",
  "company_research",
  "campaign_context",
  "release_expansion",
  "spotify_release",
  "material_extraction",
  "songwriter_research",
]);
const schema = z.strictObject({
  entry: z.enum([
    "artist",
    "songwriter",
    "company",
    "campaign",
    "release",
    "song",
    "catalog",
    "material",
  ]),
  targets: z
    .array(
      z.strictObject({
        subjectId: z.uuid(),
        kind,
        identityConfirmed: z.boolean(),
        // Server-verified presence only. Actual values are loaded by authorized collectors.
        availableFields: z.array(
          z.enum([
            "isrc",
            "spotify_id",
            "title",
            "mlc_work_code",
            "artist_account_link",
            "catalog_account_link",
            "submitted_name",
            "campaign_brief",
            "submitted_text",
          ]),
        ),
        reusableModules: z.array(moduleId),
      }),
    )
    .max(100),
  requested: z.array(z.strictObject({ subjectId: z.uuid(), module: moduleId })).max(100),
  // Resolved by server policy: credentials, selected workspace, rate limits and spend.
  permittedModules: z.array(moduleId),
});
type Kind = z.infer<typeof kind>;
type ModuleId = z.infer<typeof moduleId>;
type Field = z.infer<typeof schema>["targets"][number]["availableFields"][number];
const definitions: Record<
  ModuleId,
  { kinds: Kind[]; fields: Field[][]; implemented: boolean; executor: string | null }
> = {
  musicbrainz: {
    kinds: ["recording"],
    fields: [["isrc"]],
    implemented: true,
    executor: "collectContextMusicBrainz",
  },
  mlc_recording: {
    kinds: ["recording"],
    fields: [["isrc"]],
    implemented: true,
    executor: "collectContextMlc:recording",
  },
  mlc_search: {
    kinds: ["composition"],
    fields: [["title"]],
    implemented: true,
    executor: "collectContextMlc:search",
  },
  mlc_work: {
    kinds: ["composition"],
    fields: [["mlc_work_code"]],
    implemented: true,
    executor: "collectContextMlc:work",
  },
  songstats: {
    kinds: ["artist", "recording"],
    fields: [],
    implemented: true,
    executor: "collectContextSongstats",
  },
  saved_socials: {
    kinds: ["artist"],
    fields: [["artist_account_link"]],
    implemented: true,
    executor: "collectContextSocialEvidence",
  },
  catalog_valuation: {
    kinds: ["catalog"],
    fields: [["catalog_account_link"]],
    implemented: true,
    executor: "collectContextCatalogEstimate",
  },
  company_research: { kinds: ["company"], fields: [], implemented: false, executor: null },
  campaign_context: { kinds: ["campaign"], fields: [], implemented: false, executor: null },
  spotify_release: {
    kinds: ["release"],
    fields: [["spotify_id"]],
    implemented: true,
    executor: "collectContextSpotifyRelease",
  },
  release_expansion: { kinds: ["release"], fields: [], implemented: false, executor: null },
  material_extraction: { kinds: ["material"], fields: [], implemented: false, executor: null },
  songwriter_research: { kinds: ["songwriter"], fields: [], implemented: false, executor: null },
};
/** Pure planning only. Never accepts untrusted claims of authorization; execution rechecks access.
 * Linked targets must already be resolved: no catalog expansion, roster creation or inferred ownership.
 * This covers registered provider collectors, not every Context Engine capability.
 */
export function planContextModules(input: z.input<typeof schema>) {
  const args = schema.parse(input);
  const targets = new Map(args.targets.map(target => [target.subjectId, target]));
  if (targets.size !== args.targets.length) throw new Error("Duplicate context target");
  const keys = new Set<string>();
  return args.requested.map(request => {
    const key = `${request.subjectId}:${request.module}`;
    if (keys.has(key)) throw new Error("Duplicate requested module");
    keys.add(key);
    const target = targets.get(request.subjectId);
    if (!target) throw new Error("Requested target has not been resolved");
    const definition = definitions[request.module];
    if (!definition.kinds.includes(target.kind))
      throw new Error("Module does not support target kind");
    const required =
      request.module === "songstats"
        ? target.kind === "artist"
          ? [["spotify_id"]]
          : [["isrc", "spotify_id"]]
        : definition.fields;
    const missing = required.filter(
      alternatives =>
        !alternatives.some(field => target.availableFields.some(value => value === field)),
    );
    const reasons: string[] = [];
    // A submitted album locator is enough to request Spotify verification;
    // the collector still binds it to the saved request before any provider call.
    if (!target.identityConfirmed && request.module !== "spotify_release")
      reasons.push("Confirm the target identity before attaching evidence");
    if (!definition.implemented) reasons.push("Context collector is not implemented");
    // Reuse means server-checked suitable evidence; do not require fresh provider credentials.
    const reuse = target.reusableModules.includes(request.module);
    if (!reuse) {
      missing.forEach(fields => reasons.push(`Missing ${fields.join(" or ")}`));
      if (!args.permittedModules.includes(request.module))
        reasons.push("Server collection policy has not permitted this module");
    }
    const state = !definition.implemented
      ? "not_implemented"
      : reasons.length
        ? "blocked"
        : reuse
          ? "reuse_candidate"
          : "ready_for_dispatch";
    return {
      key,
      entry: args.entry,
      subjectId: target.subjectId,
      targetKind: target.kind,
      module: request.module,
      executor: definition.executor,
      state,
      reasons,
      dependsOn: [],
      scope: "workspace_private",
      executionStarted: false,
    };
  });
}
