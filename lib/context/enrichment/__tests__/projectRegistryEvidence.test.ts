import { expect, it } from "vitest";
import { projectRegistryEvidence } from "../projectRegistryEvidence";

const base = {
  claimKind: "registry_claim",
  identityConfirmed: false,
  ownershipVerified: false,
};

it("projects one MusicBrainz candidate with ordered artist credits and no rights claim", () => {
  const projection = projectRegistryEvidence({
    provider: "musicbrainz",
    operation: "isrc",
    payload: {
      status: "candidate_found",
      recordings: [
        {
          id: "00000000-0000-4000-8000-00000000000a",
          title: "Fixture Song",
          "artist-credit": [
            { name: "Fixture Artist", joinphrase: " feat. ", artist: { name: "Fixture Artist" } },
            { artist: { name: "Second Fixture" } },
          ],
          length: 180000,
        },
      ],
      trace: { rawResponse: { private: "stays in trace" } },
    },
  });
  expect(projection).toMatchObject({
    ...base,
    provider: "musicbrainz",
    operation: "isrc",
    status: "candidate_found",
    recordingIds: [
      {
        provider: "musicbrainz",
        id: "00000000-0000-4000-8000-00000000000a",
        title: "Fixture Song",
      },
    ],
    workIds: [],
    shares: [],
    conflicts: [],
  });
  const mbRecording = {
    provider: "musicbrainz",
    recordKind: "recording",
    recordingId: "00000000-0000-4000-8000-00000000000a",
  };
  expect(projection.credits).toEqual([
    {
      record: mbRecording,
      name: "Fixture Artist",
      role: "performing_artist_credit",
      roleCode: null,
      ipi: null,
      order: 0,
      source: "musicbrainz_artist_credit",
    },
    {
      record: mbRecording,
      name: "Second Fixture",
      role: "performing_artist_credit",
      roleCode: null,
      ipi: null,
      order: 1,
      source: "musicbrainz_artist_credit",
    },
  ]);
  expect(JSON.stringify(projection)).not.toContain("stays in trace");
  expect(JSON.stringify(projection)).not.toContain("180000");
});

it("marks several MusicBrainz recordings as needing review with an explicit conflict", () => {
  const projection = projectRegistryEvidence({
    provider: "musicbrainz",
    operation: "isrc",
    payload: {
      status: "needs_review",
      recordings: [
        { id: "a", title: "One" },
        { id: "b", title: "Two" },
      ],
    },
  });
  expect(projection.status).toBe("needs_review");
  expect(projection.recordingIds.map(recording => recording.id)).toEqual(["a", "b"]);
  expect(projection.conflicts).toEqual([
    { kind: "multiple_candidates", detail: "2 MusicBrainz recordings share this ISRC." },
  ]);
});

it("projects MLC work writers and collection shares while leaving territory and dates unknown", () => {
  const projection = projectRegistryEvidence({
    provider: "mlc",
    operation: "work",
    payload: {
      status: "source_found",
      ownershipVerified: false,
      work: {
        mlcSongCode: "123",
        iswc: "T-FIXTURE-1",
        primaryTitle: "Fixture Work",
        writers: [
          { writerFirstName: "Ada", writerLastName: "Fixture", writerIPI: "00001234567" },
          { writerLastName: "Nameless" },
        ],
        publishers: [
          { publisherName: "Fixture Music", collectionShare: 50 },
          { collectionShare: 25, administratorName: "ignored" },
        ],
      },
    },
  });
  expect(projection).toMatchObject({
    ...base,
    status: "source_found",
    recordingIds: [],
    workIds: [{ provider: "mlc", songCode: "123", iswc: "T-FIXTURE-1", title: "Fixture Work" }],
    conflicts: [],
  });
  const work = { provider: "mlc", recordKind: "work", songCode: "123" };
  expect(projection.credits).toEqual([
    {
      record: work,
      name: "Ada Fixture",
      role: "writer",
      roleCode: null,
      ipi: "00001234567",
      order: 0,
      source: "mlc_writer",
    },
    {
      record: work,
      name: "Nameless",
      role: "writer",
      roleCode: null,
      ipi: null,
      order: 1,
      source: "mlc_writer",
    },
    {
      record: work,
      name: "Fixture Music",
      role: "publisher",
      roleCode: null,
      ipi: null,
      order: 0,
      source: "mlc_publisher",
    },
    {
      record: work,
      name: null,
      role: "publisher",
      roleCode: null,
      ipi: null,
      order: 1,
      source: "mlc_publisher",
    },
  ]);
  expect(projection.shares).toEqual([
    {
      record: work,
      party: "Fixture Music",
      shareKind: "collection_share",
      percent: 50,
      territory: "unknown",
      effectiveFrom: null,
      effectiveTo: null,
      dateState: "unknown",
    },
    {
      record: work,
      party: null,
      shareKind: "collection_share",
      percent: 25,
      territory: "unknown",
      effectiveFrom: null,
      effectiveTo: null,
      dateState: "unknown",
    },
  ]);
  expect(JSON.stringify(projection)).not.toContain("administratorName");
  expect(projection.limitations.join(" ")).toMatch(/collection shares are not ownership/i);
});

it("reports an inconsistent collection-share total without correcting the source values", () => {
  const projection = projectRegistryEvidence({
    provider: "mlc",
    operation: "work",
    payload: {
      status: "source_found",
      work: {
        mlcSongCode: "123",
        publishers: [{ collectionShare: 75 }, { collectionShare: 50 }, { collectionShare: "n/a" }],
      },
    },
  });
  expect(projection.shares.map(share => share.percent)).toEqual([75, 50, null]);
  expect(projection.shares[2].shareKind).toBe("unknown");
  expect(projection.workIds).toEqual([
    { provider: "mlc", songCode: "123", iswc: null, title: null },
  ]);
  expect(projection.conflicts).toEqual([
    {
      kind: "inconsistent_share_total",
      detail: "Publisher collection shares for MLC song code 123 total 125%, above 100%.",
    },
  ]);
});

it("keeps MLC recording rows as work code candidates bound to their row, never as work titles", () => {
  const projection = projectRegistryEvidence({
    provider: "mlc",
    operation: "recording",
    payload: {
      status: "needs_review",
      candidates: [
        { isrc: "USAT22103065", mlcsongCode: "456", title: "Recording Title" },
        { isrc: "US-AT2-21-03065", mlcsongCode: "123", title: "Fixture", artist: "Fixture Artist" },
        { isrc: "USAT22103065", artist: "Unlinked Artist" },
      ],
      rejectedCount: 1,
    },
  });
  expect(projection.status).toBe("needs_review");
  expect(projection.workIds).toEqual([
    { provider: "mlc", songCode: "456", iswc: null, title: null },
    { provider: "mlc", songCode: "123", iswc: null, title: null },
  ]);
  expect(projection.credits).toEqual([
    {
      record: {
        provider: "mlc",
        recordKind: "recording_row",
        isrc: "USAT22103065",
        songCode: "123",
      },
      name: "Fixture Artist",
      role: "performing_artist_credit",
      roleCode: null,
      ipi: null,
      order: null,
      source: "mlc_recording_artist",
    },
  ]);
  expect(JSON.stringify(projection)).not.toContain("Recording Title");
  expect(JSON.stringify(projection)).not.toContain("Unlinked Artist");
  expect(projection.limitations.join(" ")).toMatch(/1 MLC recording rows without a song code/);
  expect(projection.conflicts).toEqual([
    { kind: "multiple_candidates", detail: "3 MLC recording rows match this ISRC." },
  ]);
  expect(projection.shares).toEqual([]);
});

it("projects MLC search candidates and their writers without inventing an ISWC", () => {
  const projection = projectRegistryEvidence({
    provider: "mlc",
    operation: "search",
    payload: {
      status: "candidate_found",
      identityConfirmed: false,
      candidates: [
        {
          mlcSongCode: "789",
          workTitle: "Searched Work",
          writers: [{ writerIPI: "00001234567", writerLastName: "Smith" }],
        },
      ],
    },
  });
  expect(projection.status).toBe("candidate_found");
  expect(projection.workIds).toEqual([
    { provider: "mlc", songCode: "789", iswc: null, title: "Searched Work" },
  ]);
  expect(projection.credits).toEqual([
    {
      record: { provider: "mlc", recordKind: "work", songCode: "789" },
      name: "Smith",
      role: "writer",
      roleCode: null,
      ipi: "00001234567",
      order: 0,
      source: "mlc_writer",
    },
  ]);
  expect(projection.conflicts).toEqual([]);
});

it("keeps not-found lookups empty and unknown payloads explicit instead of throwing", () => {
  const notFound = projectRegistryEvidence({
    provider: "mlc",
    operation: "work",
    payload: { status: "not_found", work: null, ownershipVerified: false },
  });
  expect(notFound).toMatchObject({
    ...base,
    status: "not_found",
    recordingIds: [],
    workIds: [],
    credits: [],
    shares: [],
    conflicts: [],
  });
  for (const payload of [null, "text", { unexpected: true }, { status: "weird", recordings: 1 }]) {
    const unknown = projectRegistryEvidence({
      provider: "musicbrainz",
      operation: "isrc",
      payload,
    });
    expect(unknown).toMatchObject({
      ...base,
      status: "unknown",
      recordingIds: [],
      workIds: [],
      credits: [],
      shares: [],
      conflicts: [],
    });
    expect(unknown.limitations.join(" ")).toMatch(/raw trace/i);
  }
});

it("binds every credit to its own candidate when several works or recordings match", () => {
  const search = projectRegistryEvidence({
    provider: "mlc",
    operation: "search",
    payload: {
      status: "needs_review",
      candidates: [
        { mlcSongCode: "A1", workTitle: "Same Title", writers: [{ writerLastName: "Xavier" }] },
        { mlcSongCode: "B2", workTitle: "Same Title", writers: [{ writerLastName: "Yolanda" }] },
      ],
    },
  });
  expect(search.status).toBe("needs_review");
  expect(search.credits.map(entry => [entry.record, entry.name, entry.order])).toEqual([
    [{ provider: "mlc", recordKind: "work", songCode: "A1" }, "Xavier", 0],
    [{ provider: "mlc", recordKind: "work", songCode: "B2" }, "Yolanda", 0],
  ]);
  const isrc = projectRegistryEvidence({
    provider: "musicbrainz",
    operation: "isrc",
    payload: {
      status: "needs_review",
      recordings: [
        { id: "r1", "artist-credit": [{ name: "First" }] },
        { id: "r2", "artist-credit": [{ name: "Second" }] },
      ],
    },
  });
  expect(isrc.credits.map(entry => [entry.record, entry.name])).toEqual([
    [{ provider: "musicbrainz", recordKind: "recording", recordingId: "r1" }, "First"],
    [{ provider: "musicbrainz", recordKind: "recording", recordingId: "r2" }, "Second"],
  ]);
});

it("bounds every projected list while counting conflicts over the complete source response", () => {
  const recordings = Array.from({ length: 101 }, (_, index) => ({
    id: `recording-${index}`,
    title: `Title ${index}`,
    "artist-credit": [{ name: `Artist ${index}` }, { name: `Guest ${index}` }],
  }));
  const projection = projectRegistryEvidence({
    provider: "musicbrainz",
    operation: "isrc",
    payload: { status: "needs_review", recordings },
  });
  expect(projection.recordingIds).toHaveLength(100);
  expect(projection.credits).toHaveLength(100);
  expect(projection.limitations.join(" ")).toMatch(/101 recordings/);
  expect(projection.limitations.join(" ")).toMatch(/200 credits in total/);
  expect(projection.conflicts).toEqual([
    { kind: "multiple_candidates", detail: "101 MusicBrainz recordings share this ISRC." },
  ]);
  const publishers = Array.from({ length: 101 }, () => ({ collectionShare: 1 }));
  const work = projectRegistryEvidence({
    provider: "mlc",
    operation: "work",
    payload: { status: "source_found", work: { mlcSongCode: "123", publishers } },
  });
  expect(work.shares).toHaveLength(100);
  expect(work.conflicts).toEqual([
    {
      kind: "inconsistent_share_total",
      detail: "Publisher collection shares for MLC song code 123 total 101%, above 100%.",
    },
  ]);
  expect(() =>
    projectRegistryEvidence({ provider: "musicbrainz", operation: "work", payload: {} }),
  ).toThrow();
  expect(() =>
    projectRegistryEvidence({ provider: "mlc", operation: "isrc", payload: {} }),
  ).toThrow();
});
