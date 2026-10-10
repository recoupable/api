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

/** The source record a credit or share was read from; claims are never pooled across records. */
export type RegistryRecordRef =
  | { provider: "musicbrainz"; recordKind: "recording"; recordingId: string }
  | { provider: "mlc"; recordKind: "recording_row"; isrc: string | null; songCode: string }
  | { provider: "mlc"; recordKind: "work"; songCode: string };
export interface RegistryCredit {
  record: RegistryRecordRef;
  name: string | null;
  role: "performing_artist_credit" | "writer" | "publisher" | "unknown";
  roleCode: string | null;
  ipi: string | null;
  order: number | null;
  source: "musicbrainz_artist_credit" | "mlc_recording_artist" | "mlc_writer" | "mlc_publisher";
}
export interface RegistryShare {
  record: Extract<RegistryRecordRef, { recordKind: "work" }>;
  party: string | null;
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
type Rows = Record<string, unknown>[];
type WorkRef = Extract<RegistryRecordRef, { recordKind: "work" }>;

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const list = (value: unknown): Rows =>
  Array.isArray(value)
    ? value.map(record).filter((item): item is Record<string, unknown> => !!item)
    : [];
const workRef = (songCode: string): WorkRef => ({ provider: "mlc", recordKind: "work", songCode });
const credit = (
  ref: RegistryRecordRef,
  source: RegistryCredit["source"],
  role: RegistryCredit["role"],
  name: string | null,
  order: number | null,
  extra: { roleCode?: unknown; ipi?: unknown } = {},
): RegistryCredit => ({
  record: ref,
  name,
  role,
  roleCode: text(extra.roleCode),
  ipi: text(extra.ipi),
  order,
  source,
});

/** First BOUND items; anything beyond is named in a limitation and left in the raw trace. */
function bound<T>(projection: RegistryEvidenceProjection, items: T[], label: string): T[] {
  if (items.length > BOUND)
    projection.limitations.push(
      `Only the first ${BOUND} of ${items.length} ${label} are projected; see the raw trace.`,
    );
  return items.slice(0, BOUND);
}

/** Counts use the complete source list, never the bounded slice. */
function flagCandidates(projection: RegistryEvidenceProjection, count: number, detail: string) {
  if (count <= 1) return;
  projection.status = "needs_review";
  projection.conflicts.push({ kind: "multiple_candidates", detail });
}

function noteSkipped(projection: RegistryEvidenceProjection, skipped: number, detail: string) {
  if (skipped) projection.limitations.push(`${skipped} ${detail}; see the raw trace.`);
}

function writerCredits(projection: RegistryEvidenceProjection, ref: WorkRef, writers: unknown) {
  return bound(projection, list(writers), `writers for MLC song code ${ref.songCode}`).map(
    (writer, order) =>
      credit(
        ref,
        "mlc_writer",
        "writer",
        text([text(writer.writerFirstName), text(writer.writerLastName)].filter(Boolean).join(" ")),
        order,
        { roleCode: writer.writerRoleCode, ipi: writer.writerIPI },
      ),
  );
}

function projectMusicBrainzIsrc(projection: RegistryEvidenceProjection, data: Rows[number]) {
  const all = list(data.recordings);
  flagCandidates(projection, all.length, `${all.length} MusicBrainz recordings share this ISRC.`);
  let skipped = 0;
  for (const recording of bound(projection, all, "recordings")) {
    const id = text(recording.id);
    if (!id) {
      skipped += 1;
      continue;
    }
    const ref: RegistryRecordRef = {
      provider: "musicbrainz",
      recordKind: "recording",
      recordingId: id,
    };
    projection.recordingIds.push({ provider: "musicbrainz", id, title: text(recording.title) });
    bound(
      projection,
      list(recording["artist-credit"]),
      `artist credits for recording ${id}`,
    ).forEach((entry, order) =>
      projection.credits.push(
        credit(
          ref,
          "musicbrainz_artist_credit",
          "performing_artist_credit",
          text(entry.name) ?? text(record(entry.artist)?.name),
          order,
        ),
      ),
    );
  }
  noteSkipped(projection, skipped, "MusicBrainz recordings without an MBID are not projected");
}

function projectMlcRecording(projection: RegistryEvidenceProjection, data: Rows[number]) {
  const all = list(data.candidates);
  flagCandidates(projection, all.length, `${all.length} MLC recording rows match this ISRC.`);
  let skipped = 0;
  for (const candidate of bound(projection, all, "candidates")) {
    const songCode = text(candidate.mlcsongCode);
    if (!songCode) {
      skipped += 1;
      continue;
    }
    const isrc = text(candidate.isrc)?.replace(/-/g, "").toUpperCase() ?? null;
    // A recording row's title is the recording title, not the work title.
    projection.workIds.push({ provider: "mlc", songCode, iswc: null, title: null });
    const artist = text(candidate.artist);
    // The row carries one artist string, not an ordered credit list, so order is not supplied.
    if (artist)
      projection.credits.push(
        credit(
          { provider: "mlc", recordKind: "recording_row", isrc, songCode },
          "mlc_recording_artist",
          "performing_artist_credit",
          artist,
          null,
        ),
      );
  }
  noteSkipped(projection, skipped, "MLC recording rows without a song code are not projected");
  projection.limitations.push(
    "A recording match links candidate work codes only; no writer, publisher, share or work title is inferred.",
  );
}

function projectMlcSearch(projection: RegistryEvidenceProjection, data: Rows[number]) {
  const all = list(data.candidates);
  flagCandidates(projection, all.length, `${all.length} MLC works match this title search.`);
  let skipped = 0;
  for (const candidate of bound(projection, all, "candidates")) {
    const songCode = text(candidate.mlcSongCode);
    if (!songCode) {
      skipped += 1;
      continue;
    }
    const iswc = text(candidate.iswc);
    projection.workIds.push({ provider: "mlc", songCode, iswc, title: text(candidate.workTitle) });
    projection.credits.push(...writerCredits(projection, workRef(songCode), candidate.writers));
  }
  noteSkipped(projection, skipped, "MLC search candidates without a song code are not projected");
}

const percentOf = (publisher: Rows[number]) => {
  const share = publisher.collectionShare;
  return typeof share === "number" && Number.isFinite(share) ? share : null;
};

function projectPublishers(projection: RegistryEvidenceProjection, ref: WorkRef, publishers: Rows) {
  bound(projection, publishers, `publishers for MLC song code ${ref.songCode}`).forEach(
    (publisher, order) => {
      const party = text(publisher.publisherName);
      const percent = percentOf(publisher);
      projection.credits.push(
        credit(ref, "mlc_publisher", "publisher", party, order, {
          roleCode: publisher.publisherRoleCode,
          ipi: publisher.publisherIpiNumber,
        }),
      );
      projection.shares.push({
        record: ref,
        party,
        shareKind: percent === null ? "unknown" : "collection_share",
        percent,
        territory: "unknown",
        effectiveFrom: null,
        effectiveTo: null,
        dateState: "unknown",
      });
    },
  );
}

function projectMlcWork(projection: RegistryEvidenceProjection, data: Rows[number]) {
  const work = record(data.work);
  const songCode = text(work?.mlcSongCode);
  if (!work || !songCode) return;
  const ref = workRef(songCode);
  projection.workIds.push({
    provider: "mlc",
    songCode,
    iswc: text(work.iswc),
    title: text(work.primaryTitle),
  });
  projection.credits.push(...writerCredits(projection, ref, work.writers));
  const publishers = list(work.publishers);
  projectPublishers(projection, ref, publishers);
  // The total covers every publisher row the source returned, including rows past the bound.
  const total =
    Math.round(publishers.reduce((sum, publisher) => sum + (percentOf(publisher) ?? 0), 0) * 1e4) /
    1e4;
  if (total > 100)
    projection.conflicts.push({
      kind: "inconsistent_share_total",
      detail: `Publisher collection shares for MLC song code ${songCode} total ${total}%, above 100%.`,
    });
  projection.limitations.push(
    "Collection shares are not ownership shares; territory and effective dates are not supplied by this lookup and remain unknown.",
  );
}

const projectors = {
  isrc: projectMusicBrainzIsrc,
  recording: projectMlcRecording,
  search: projectMlcSearch,
  work: projectMlcWork,
};

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
  projectors[operation](projection, data);
  // Per-record lists are bounded above; this bounds the combined list across all candidates.
  projection.credits = bound(projection, projection.credits, "credits in total");
  return projection;
}
