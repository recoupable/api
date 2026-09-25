import { z } from "zod";
import { authorizeContextOwner } from "@/lib/context/authorizeContextOwner";
import { parseContextUrl } from "@/lib/context/parseContextUrl";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { listContextRequestTargets } from "@/lib/supabase/context_requests/listContextRequestTargets";
import { planContextModules } from "./planContextModules";

const requestSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid(),
  status: z.string(),
  input: z.unknown(),
});

/** Read-only review plan. Never grants provider or paid-call permission. */
export async function planStoredContextModules(actor: string, owner: string, requestId: string) {
  z.uuid().parse(actor);
  z.uuid().parse(owner);
  z.uuid().parse(requestId);
  const access = await authorizeContextOwner(actor, owner === actor ? undefined : owner);
  if (access.ownerId !== owner) throw new Error("Access denied to context owner");
  const request = requestSchema.parse(
    await callContextRpc("read_context_request", { p_owner: owner, p_request: requestId }),
  );
  if (request.id !== requestId || request.owner_id !== owner)
    throw new Error("Context request not found");
  if (!(["partial", "completed"] as string[]).includes(request.status))
    throw new Error("Context request is not ready for planning");

  const input = z
    .object({ kind: z.string().optional(), url: z.string().optional() })
    .parse(request.input);
  let entry:
    | "song"
    | "catalog"
    | "artist"
    | "songwriter"
    | "company"
    | "campaign"
    | "material"
    | "release";
  if (input.kind === "catalog") entry = "catalog";
  else if (input.kind === "artist") entry = "artist";
  else if (input.kind === "songwriter") entry = "songwriter";
  else if (input.kind === "company") entry = "company";
  else if (input.kind === "campaign") entry = "campaign";
  else if (input.kind === "material") entry = "material";
  else if (input.kind === "release") entry = "release";
  else if (input.url) {
    const resource = parseContextUrl(input.url);
    if (resource.provider !== "spotify" || resource.kind !== "track")
      throw new Error("Unsupported saved context entry");
    entry = "song";
  } else throw new Error("Unsupported saved context entry");

  const targets =
    entry === "release"
      ? [
          z
            .strictObject({
              subjectId: z.uuid(),
              kind: z.literal("release"),
              identityConfirmed: z.literal(false),
              availableFields: z.array(z.literal("spotify_id")).length(1),
              reusableModules: z.array(z.string()),
            })
            .parse(
              await callContextRpc("list_context_release_request_target", {
                p_owner: owner,
                p_request: requestId,
              }),
            ),
        ]
      : entry === "songwriter"
        ? [
            z
              .strictObject({
                subjectId: z.uuid(),
                kind: z.literal("songwriter"),
                identityConfirmed: z.literal(false),
                availableFields: z.array(z.literal("submitted_name")).length(1),
                reusableModules: z.array(z.string()),
              })
              .parse(
                await callContextRpc("list_context_songwriter_request_target", {
                  p_owner: owner,
                  p_request: requestId,
                }),
              ),
          ]
        : entry === "company"
          ? [
              z
                .strictObject({
                  subjectId: z.uuid(),
                  kind: z.literal("company"),
                  identityConfirmed: z.literal(false),
                  availableFields: z.array(z.literal("submitted_name")).length(1),
                  reusableModules: z.array(z.string()),
                })
                .parse(
                  await callContextRpc("list_context_company_request_target", {
                    p_owner: owner,
                    p_request: requestId,
                  }),
                ),
            ]
          : entry === "campaign"
            ? [
                z
                  .strictObject({
                    subjectId: z.uuid(),
                    kind: z.literal("campaign"),
                    identityConfirmed: z.literal(false),
                    availableFields: z.array(z.literal("campaign_brief")).length(1),
                    reusableModules: z.array(z.string()),
                  })
                  .parse(
                    await callContextRpc("list_context_campaign_request_target", {
                      p_owner: owner,
                      p_request: requestId,
                    }),
                  ),
              ]
            : entry === "material"
              ? [
                  z
                    .strictObject({
                      subjectId: z.uuid(),
                      kind: z.literal("material"),
                      identityConfirmed: z.literal(false),
                      availableFields: z.array(z.literal("submitted_text")).length(1),
                      reusableModules: z.array(z.string()),
                    })
                    .parse(
                      await callContextRpc("list_context_material_request_target", {
                        p_owner: owner,
                        p_request: requestId,
                      }),
                    ),
                ]
              : entry === "artist"
                ? [
                    z
                      .strictObject({
                        subjectId: z.uuid(),
                        kind: z.literal("artist"),
                        identityConfirmed: z.literal(true),
                        availableFields: z.array(z.enum(["artist_account_link", "spotify_id"])),
                        reusableModules: z.array(z.string()),
                      })
                      .parse(
                        await callContextRpc("list_context_artist_request_target", {
                          p_owner: owner,
                          p_request: requestId,
                        }),
                      ),
                  ]
                : await listContextRequestTargets(owner, requestId);
  const requested: {
    subjectId: string;
    module:
      | "musicbrainz"
      | "mlc_recording"
      | "songstats"
      | "spotify_release"
      | "saved_socials"
      | "catalog_valuation"
      | "songwriter_research"
      | "company_research"
      | "campaign_context"
      | "material_extraction";
  }[] = [];
  for (const target of targets) {
    const modules =
      entry === "release"
        ? target.kind === "release"
          ? (["spotify_release"] as const)
          : []
        : entry === "songwriter"
          ? target.kind === "songwriter"
            ? (["songwriter_research"] as const)
            : []
          : entry === "company"
            ? target.kind === "company"
              ? (["company_research"] as const)
              : []
            : entry === "campaign"
              ? target.kind === "campaign"
                ? (["campaign_context"] as const)
                : []
              : entry === "material"
                ? target.kind === "material"
                  ? (["material_extraction"] as const)
                  : []
                : entry === "artist"
                  ? target.kind === "artist"
                    ? (["songstats", "saved_socials"] as const)
                    : []
                  : entry === "catalog"
                    ? target.kind === "catalog"
                      ? (["catalog_valuation"] as const)
                      : []
                    : target.kind === "recording"
                      ? (["musicbrainz", "mlc_recording", "songstats"] as const)
                      : target.kind === "release"
                        ? (["spotify_release"] as const)
                        : target.kind === "artist"
                          ? (["songstats", "saved_socials"] as const)
                          : [];
    for (const module of modules) requested.push({ subjectId: target.subjectId, module });
  }
  if (!requested.length) throw new Error("No supported subjects in saved context request");
  const supportedKind = z.enum([
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
  const plannedTargets = targets
    .filter(target => target.kind !== "video")
    .map(target => ({
      ...target,
      kind: supportedKind.parse(target.kind),
      // The saved-target lookup does not yet inspect reusable result evidence.
      reusableModules: [] as [],
    }));
  const plan = planContextModules({
    entry,
    targets: plannedTargets,
    requested,
    permittedModules: [],
  });
  return { requestId, entry, plan, collectionPermitted: false };
}
