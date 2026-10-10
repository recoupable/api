import { expect, it, vi } from "vitest";
import { processContextOperation } from "../processContextOperation";
import type { ContextBriefDocument } from "../selectContextDocuments";
import type { compileContextBrief } from "../compileContextBrief";

type Brief = ReturnType<typeof compileContextBrief>;

vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

// Fixture identifiers only; no production, customer or provider IDs.
const owner = "11111111-1111-4111-8111-111111111111";
const otherWorkspace = "99999999-9999-4999-8999-999999999999";
const requestA = "22222222-2222-4222-8222-22222222222a";
const requestB = "22222222-2222-4222-8222-22222222222b";
const requestMaterial = "22222222-2222-4222-8222-22222222222c";
const songA = "33333333-3333-4333-8333-33333333333a";
const songB = "33333333-3333-4333-8333-33333333333b";
const artist = "44444444-4444-4444-8444-444444444444";
const material = "55555555-5555-4555-8555-555555555555";
const retrieved = {
  artistResearch: "2026-09-20T09:00:00.000Z",
  songA: "2026-09-21T10:00:00.000Z",
  songBOlder: "2026-09-19T08:00:00.000Z",
  songB: "2026-09-22T11:30:00.000Z",
};
const requestSubjects: Record<string, string[]> = {
  [requestA]: [songA, artist],
  [requestB]: [songB, artist],
  [requestMaterial]: [material],
};

const document = (
  subjectId: string,
  topic: string,
  retrievedAt: (string | null)[],
  overrides: Partial<ContextBriefDocument> = {},
): ContextBriefDocument => {
  const id = `${subjectId.slice(-4)}:${topic}`;
  return {
    id,
    resultId: `${id}:result`,
    ownerId: owner,
    subjectId,
    topic,
    version: 2,
    status: "accepted",
    evidenceKind: "observation",
    text: `${id} evidence`,
    sourceVersionIds: retrievedAt.map((_, index) => `${id}:source-${index}`),
    coverage: "full",
    // Source locations are private; the brief text and manifest must never repeat them.
    sources: retrievedAt.map((value, index) => ({
      versionId: `${id}:source-${index}`,
      url: `https://private-source.example.test/${id}/${index}`,
      retrievedAt: value,
    })),
    ...overrides,
  };
};

const workspace: ContextBriefDocument[] = [
  document(songA, "song_summary", [retrieved.songA]),
  document(songA, "lyrics", [retrieved.songA], {
    coverage: "partial",
    text: "LYRICS-A preview transcript",
  }),
  document(songA, "artwork_branding", [retrieved.songA], { text: "ARTWORK-A observed palette" }),
  document(songA, "recording_metadata", [retrieved.songA]),
  document(songA, "release_metadata", [retrieved.songA]),
  document(songA, "catalog_metadata", [retrieved.songA], { text: "CATALOG-A audio features" }),
  document(songB, "song_summary", [retrieved.songB]),
  document(songB, "artwork_branding", [retrieved.songB], { text: "ARTWORK-B observed palette" }),
  document(songB, "recording_metadata", [retrieved.songB]),
  document(songB, "release_metadata", [retrieved.songBOlder, retrieved.songB]),
  document(songB, "catalog_metadata", [retrieved.songB], { text: "CATALOG-B audio features" }),
  document(artist, "artist_research", [retrieved.artistResearch]),
  document(artist, "artist_metadata", [null]),
  // Newer withdrawn revision must not displace or leak into the accepted artwork document.
  document(songA, "artwork_branding", [retrieved.songA], {
    id: "withdrawn:artwork",
    resultId: "withdrawn:artwork:result",
    version: 3,
    status: "withdrawn",
    text: "WITHDRAWN artwork observation",
  }),
  document(material, "material_input", [retrieved.songA], {
    evidenceKind: "customer_assertion",
    coverage: "partial",
    text: "PRIVATE supporting text with internal campaign notes",
  }),
  document(songA, "lyrics", [retrieved.songA], {
    id: "other:lyrics",
    ownerId: otherWorkspace,
    text: "OTHER-WORKSPACE lyrics",
  }),
];

function createDeps() {
  const snapshots = new Map<string, unknown>();
  const rpc = vi.fn(async (name: string, params: Record<string, unknown>) => {
    expect(params.p_owner).toBe(owner);
    const requestId = String(params.p_request);
    if (name === "read_context_request")
      return {
        id: requestId,
        owner_id: owner,
        status: requestId === requestA ? "partial" : "completed",
        output: { subjectIds: requestSubjects[requestId] },
      };
    // The RPC filters by workspace and subject; the compiler re-checks status and owner.
    if (name === "read_context_documents")
      return workspace.filter(doc => requestSubjects[requestId].includes(doc.subjectId));
    if (name === "save_context_brief") {
      const id = `66666666-6666-4666-8666-${String(params.p_key).length.toString().padStart(12, "0")}`;
      if (!snapshots.has(id))
        snapshots.set(id, {
          id,
          state: "saved",
          superseded: false,
          purpose: (params.p_snapshot as { purpose: string }).purpose,
          brief: params.p_snapshot,
        });
      return snapshots.get(id);
    }
    if (name === "read_context_brief") return snapshots.get(String(params.p_brief)) ?? null;
    throw new Error(`Unexpected RPC ${name}`);
  });
  return {
    rpc,
    dispatch: vi.fn(),
    authorize: vi.fn(async () => ({ ownerId: owner, accountId: owner, organizationId: null })),
  };
}

const compile = (purpose: "creative_direction" | "playlist_pitch", deps = createDeps()) =>
  processContextOperation(
    owner,
    {
      action: "brief",
      request_id: requestA,
      additional_request_ids: [requestB, requestMaterial, requestA],
      purpose,
    },
    deps,
  ) as Promise<Brief>;

it("reuses shared artist evidence once while keeping per-song documents separate", async () => {
  const deps = createDeps();
  const creative = await compile("creative_direction", deps);
  expect(deps.dispatch).not.toHaveBeenCalled();
  expect(deps.rpc.mock.calls.filter(([name]) => name === "read_context_request")).toHaveLength(3);
  expect(creative.request_ids).toEqual([requestA, requestB, requestMaterial]);
  expect(creative.documents.filter(doc => doc.subjectId === artist)).toEqual([
    expect.objectContaining({ topic: "artist_research" }),
    expect.objectContaining({ topic: "artist_metadata" }),
  ]);
  for (const topic of ["recording_metadata", "release_metadata", "artwork_branding"])
    expect(creative.documents.filter(doc => doc.topic === topic).map(doc => doc.subjectId)).toEqual(
      [songA, songB],
    );
  expect(creative.text).toContain("ARTWORK-A observed palette");
  expect(creative.text).toContain("ARTWORK-B observed palette");
  expect(creative.text).toContain("LYRICS-A preview transcript");
});

it("keeps each brief task-specific and honest about lyric coverage", async () => {
  const creative = await compile("creative_direction");
  const pitch = await compile("playlist_pitch");
  expect(pitch.text).toContain("Playlist-pitch brief");
  expect(pitch.text).not.toMatch(/LYRICS-A|ARTWORK-A|ARTWORK-B/);
  expect(pitch.text).toContain("CATALOG-A audio features");
  expect(pitch.text).toContain("CATALOG-B audio features");
  expect(creative.text).not.toMatch(/CATALOG-A|CATALOG-B/);
  expect(creative.input_manifest.excludedTopics).toEqual(["catalog_metadata", "material_input"]);
  expect(pitch.input_manifest.excludedTopics).toEqual([
    "artwork_branding",
    "lyrics",
    "material_input",
  ]);
  expect(creative.readiness).toBe("partial");
  expect(pitch.readiness).toBe("partial");
  expect(creative.gaps).toContainEqual({
    requestId: requestA,
    topic: "lyrics",
    subjectId: songA,
    status: "partial",
    reason: expect.any(String),
  });
  expect(creative.gaps).toContainEqual({
    requestId: requestB,
    topic: "lyrics",
    subjectId: null,
    status: "unavailable",
    reason: expect.any(String),
  });
  expect(pitch.gaps.some(gap => gap.topic === "lyrics")).toBe(false);
});

it("keeps private assertions, withdrawn evidence, other workspaces and source locations out", async () => {
  for (const purpose of ["creative_direction", "playlist_pitch"] as const) {
    const brief = await compile(purpose);
    expect(brief.text).not.toMatch(/PRIVATE|WITHDRAWN|OTHER-WORKSPACE/);
    expect(brief.documents.map(doc => doc.id)).not.toContain("withdrawn:artwork");
    expect(brief.documents.some(doc => doc.evidenceKind === "customer_assertion")).toBe(false);
    expect(brief.text).not.toContain("example.test");
    expect(JSON.stringify(brief.input_manifest)).not.toContain("example.test");
  }
});

it("attributes evidence freshness without changing the snapshot-compatible manifest shape", async () => {
  const brief = await compile("creative_direction");
  expect(brief.input_manifest.compilerVersion).toBe("context-brief-v1");
  for (const entry of brief.input_manifest.documents)
    expect(Object.keys(entry).sort()).toEqual([
      "documentId",
      "resultId",
      "sourceVersionIds",
      "subjectId",
      "topic",
      "version",
    ]);
  expect(brief.input_manifest.freshness).toMatchObject({
    oldestRetrievedAt: retrieved.artistResearch,
    newestRetrievedAt: retrieved.songB,
    documentsWithoutRetrievalDate: ["4444:artist_metadata"],
  });
  expect(brief.input_manifest.freshness.documents).toContainEqual({
    documentId: "333b:release_metadata",
    retrievedAt: retrieved.songB,
  });
  expect(brief.input_manifest.freshness.documents).toContainEqual({
    documentId: "4444:artist_metadata",
    retrievedAt: null,
  });
  expect(brief.input_manifest.freshness.documents).toHaveLength(brief.documents.length);
  expect(brief.text).toContain(`Retrieved: ${retrieved.songA}`);
  expect(brief.text).toContain("Retrieved: unknown");
});

it("saves and reopens identical snapshots for both consumers without dispatch", async () => {
  const deps = createDeps();
  for (const purpose of ["creative_direction", "playlist_pitch"] as const) {
    const compiled = await compile(purpose, deps);
    const saved = (await processContextOperation(
      owner,
      {
        action: "save_brief",
        request_id: requestA,
        additional_request_ids: [requestB, requestMaterial],
        purpose,
        idempotency_key: `${purpose}-v1`,
      },
      deps,
    )) as { snapshot: { id: string; brief: unknown } };
    expect(saved.snapshot.brief).toEqual(compiled);
    const read = await processContextOperation(
      owner,
      { action: "read_brief", brief_id: saved.snapshot.id },
      deps,
    );
    expect(read).toEqual(saved);
  }
  expect(deps.dispatch).not.toHaveBeenCalled();
});
