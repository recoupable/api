import { z } from "zod";

/** Upper bound per projected list; the complete source response stays in the raw trace. */
const BOUND = 100;
const statuses = [
  "candidate_found",
  "needs_review",
  "not_found",
  "source_found",
  "unknown",
] as const;
const row = z.record(z.string(), z.unknown());
const rows = z.array(row);
const inputSchema = z.discriminatedUnion("provider", [
  z.strictObject({
    provider: z.literal("musicbrainz"),
    operation: z.literal("isrc"),
    payload: z.unknown(),
  }),
  z.strictObject({
    provider: z.literal("mlc"),
    operation: z.enum(["recording", "work", "search"]),
    payload: z.unknown(),
  }),
]);
const shapes = {
  isrc: z.looseObject({ recordings: rows }),
  recording: z.looseObject({ candidates: rows }),
  work: z.looseObject({ work: row.nullable() }),
  search: z.looseObject({ candidates: rows }),
};

export interface RegistryCredit {
  name: string;
  role: "performing_artist_credit" | "writer" | "publisher" | "unknown";
  roleCode: string | null;
  ipi: string | null;
  order: number | null;
  source: "musicbrainz_artist_credit" | "mlc_recording_artist" | "mlc_writer" | "mlc_publisher";
}
export interface RegistryShare {
  party: string;
  shareKind: "collection_share" | "unknown";
  percent: number | null;
  territory: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  dateState: "unknown";
}
/** Normalised registry claims. Never identity confirmation, ownership or collection authority. */
export interface RegistryEvidenceProjection {
  projectionVersion: "registry-evidence-v1";
  claimKind: "registry_claim";
  identityConfirmed: false;
  ownershipVerified: false;
  provider: "musicbrainz" | "mlc";
  operation: "isrc" | "recording" | "work" | "search";
  status: (typeof statuses)[number];
  recordingIds: { provider: "musicbrainz"; id: string; title: string | null }[];
  workIds: { provider: "mlc"; songCode: string; iswc: string | null; title: string | null }[];
  credits: RegistryCredit[];
  shares: RegistryShare[];
  conflicts: { kind: "multiple_candidates" | "inconsistent_share_total"; detail: string }[];
  limitations: string[];
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.map(record).filter((item): item is Record<string, unknown> => !!item)
    : [];
const credit = (
  source: RegistryCredit["source"],
  role: RegistryCredit["role"],
  name: string | null,
  order: number,
  extra: { roleCode?: unknown; ipi?: unknown } = {},
): RegistryCredit => ({
  name: name ?? "unknown",
  role,
  roleCode: text(extra.roleCode),
  ipi: text(extra.ipi),
  order,
  source,
});
const writerCredits = (writers: Record<string, unknown>[]) =>
  writers.map((writer, order) =>
    credit(
      "mlc_writer",
      "writer",
      text([text(writer.writerFirstName), text(writer.writerLastName)].filter(Boolean).join(" ")),
      order,
      { roleCode: writer.writerRoleCode, ipi: writer.writerIPI },
    ),
  );

/** Project saved MusicBrainz/MLC lookup results into bounded registry claims; unknown stays unknown. */
export function projectRegistryEvidence(input: {
  provider: "musicbrainz" | "mlc";
  operation: "isrc" | "recording" | "work" | "search";
  payload: unknown;
}): RegistryEvidenceProjection {
  const { provider, operation, payload } = inputSchema.parse(input);
  const projection: RegistryEvidenceProjection = {
    projectionVersion: "registry-evidence-v1",
    claimKind: "registry_claim",
    identityConfirmed: false,
    ownershipVerified: false,
    provider,
    operation,
    status: "unknown",
    recordingIds: [],
    workIds: [],
    credits: [],
    shares: [],
    conflicts: [],
    limitations: [
      "Registry claims are source assertions; identity, rights and ownership are not confirmed.",
    ],
  };
  const parsed = shapes[operation].safeParse(payload);
  if (!parsed.success) {
    projection.limitations.push(
      `Unrecognised ${provider} ${operation} payload; the retained raw trace holds the source response.`,
    );
    return projection;
  }
  const data = parsed.data as Record<string, unknown>;
  const status = statuses.find(candidate => candidate === data.status);
  projection.status = status ?? "unknown";
  if (!status) projection.limitations.push("Source lookup status was not recognised.");
  const bounded = (items: Record<string, unknown>[], label: string) => {
    if (items.length > BOUND)
      projection.limitations.push(
        `Only the first ${BOUND} of ${items.length} ${label} are projected; see the raw trace.`,
      );
    return items.slice(0, BOUND);
  };
  const ambiguous = (count: number, detail: string) => {
    if (count <= 1) return;
    projection.status = "needs_review";
    projection.conflicts.push({ kind: "multiple_candidates", detail });
  };
  if (operation === "isrc") {
    const recordings = bounded(list(data.recordings), "recordings");
    ambiguous(recordings.length, `${recordings.length} MusicBrainz recordings share this ISRC.`);
    for (const recording of recordings) {
      const id = text(recording.id);
      if (!id) continue;
      projection.recordingIds.push({ provider: "musicbrainz", id, title: text(recording.title) });
      bounded(list(recording["artist-credit"]), "artist credits").forEach((entry, order) =>
        projection.credits.push(
          credit(
            "musicbrainz_artist_credit",
            "performing_artist_credit",
            text(entry.name) ?? text(record(entry.artist)?.name),
            order,
          ),
        ),
      );
    }
    return projection;
  }
  if (operation === "recording") {
    const candidates = bounded(list(data.candidates), "candidates");
    ambiguous(candidates.length, `${candidates.length} MLC recording rows match this ISRC.`);
    candidates.forEach((candidate, order) => {
      const songCode = text(candidate.mlcsongCode);
      if (songCode)
        projection.workIds.push({
          provider: "mlc",
          songCode,
          iswc: null,
          title: text(candidate.title),
        });
      const artist = text(candidate.artist);
      if (artist)
        projection.credits.push(
          credit("mlc_recording_artist", "performing_artist_credit", artist, order),
        );
    });
    projection.limitations.push(
      "A recording match links candidate work codes only; no writer, publisher or share is inferred.",
    );
    return projection;
  }
  if (operation === "search") {
    const candidates = bounded(list(data.candidates), "candidates");
    ambiguous(candidates.length, `${candidates.length} MLC works match this title search.`);
    for (const candidate of candidates) {
      const songCode = text(candidate.mlcSongCode);
      if (!songCode) continue;
      projection.workIds.push({
        provider: "mlc",
        songCode,
        iswc: text(candidate.iswc),
        title: text(candidate.workTitle),
      });
      projection.credits.push(...writerCredits(bounded(list(candidate.writers), "writers")));
    }
    return projection;
  }
  const work = record(data.work);
  const songCode = text(work?.mlcSongCode);
  if (work && songCode) {
    projection.workIds.push({
      provider: "mlc",
      songCode,
      iswc: text(work.iswc),
      title: text(work.primaryTitle),
    });
    projection.credits.push(...writerCredits(bounded(list(work.writers), "writers")));
    const publishers = bounded(list(work.publishers), "publishers");
    publishers.forEach((publisher, order) => {
      const party = text(publisher.publisherName);
      const share = publisher.collectionShare;
      const percent = typeof share === "number" && Number.isFinite(share) ? share : null;
      projection.credits.push(
        credit("mlc_publisher", "publisher", party, order, {
          roleCode: publisher.publisherRoleCode,
          ipi: publisher.publisherIpiNumber,
        }),
      );
      projection.shares.push({
        party: party ?? "unknown",
        shareKind: percent === null ? "unknown" : "collection_share",
        percent,
        territory: "unknown",
        effectiveFrom: null,
        effectiveTo: null,
        dateState: "unknown",
      });
    });
    const total =
      Math.round(projection.shares.reduce((sum, share) => sum + (share.percent ?? 0), 0) * 10000) /
      10000;
    if (total > 100)
      projection.conflicts.push({
        kind: "inconsistent_share_total",
        detail: `Publisher collection shares total ${total}%, above 100%.`,
      });
    projection.limitations.push(
      "Collection shares are not ownership shares; territory and effective dates are not supplied by this lookup and remain unknown.",
    );
  }
  return projection;
}
