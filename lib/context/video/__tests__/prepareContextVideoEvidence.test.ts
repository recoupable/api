import { expect, it, vi } from "vitest";
import { prepareContextVideoEvidence } from "../prepareContextVideoEvidence";
import type { ContextBriefDocument } from "../../selectContextDocuments";

const owner = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const videoSubject = "33333333-3333-4333-8333-333333333333";
const artist = "44444444-4444-4444-8444-444444444444";
const sourceId = "55555555-5555-4555-8555-555555555555";
const recording = "66666666-6666-4666-8666-666666666666";
const url = "https://www.youtube.com/watch?v=abcdefghijk";
const document: ContextBriefDocument = {
  id: "77777777-7777-4777-8777-777777777777",
  resultId: recording,
  ownerId: owner,
  subjectId: artist,
  topic: "artist_research",
  version: 1,
  status: "accepted",
  evidenceKind: "observation",
  text: "Previously accepted artist research",
  sourceVersionIds: [sourceId],
  coverage: "partial",
};
function fixture() {
  const evidence = {
    requestId,
    ownerId: owner,
    videoSubjectId: videoSubject,
    videoId: "abcdefghijk",
    mediaVersion: "upload-v1",
    durationSeconds: 180,
    variant: "original",
    title: "Fixture song video",
    description: "Fixture description",
    channel: { id: "label-channel", name: "Label uploader" },
    performers: [{ name: "Guest performer", sourceVersionIds: [sourceId] }],
    identity: {
      state: "matched",
      recordingSubjectId: recording,
      creditedArtists: [{ subjectId: artist, name: "Credited artist" }],
      sourceVersionIds: [sourceId],
    },
    sources: [
      {
        versionId: sourceId,
        videoId: "abcdefghijk",
        mediaVersion: "upload-v1",
        retrievedAt: "2026-11-18T05:00:00Z",
      },
    ],
    captions: {
      state: "available",
      sourceVersionIds: [sourceId],
      segments: [
        { startSeconds: 0, endSeconds: 12, language: "es", text: "Synthetic caption" },
        { startSeconds: 20, endSeconds: 30, language: "en", text: "Another synthetic caption" },
      ],
    },
    analysis: {
      state: "available",
      sourceVersionIds: [sourceId],
      ranges: [
        {
          startSeconds: 0,
          endSeconds: 30,
          observations: ["A figure crosses a room"],
          interpretation: "The scene suggests departure",
        },
      ],
    },
  };
  const deps = {
    authorize: vi.fn(async () => true),
    readRequest: vi.fn(async () => ({
      id: requestId,
      owner_id: owner,
      created_by: owner,
      input: { url },
      status: "partial",
    })),
    readEvidence: vi.fn(async () => evidence),
    readArtistDocuments: vi.fn(async () => ({
      documents: [document],
      withdrawnSourceVersionIds: [] as string[],
    })),
  };
  return { evidence, deps };
}
const prepare = (deps: ReturnType<typeof fixture>["deps"]) =>
  prepareContextVideoEvidence(owner, owner, requestId, deps);

it("projects one video using shared module/result shapes and reuses artist evidence unchanged", async () => {
  const { deps } = fixture();
  const result = await prepare(deps);
  expect(result.module).toMatchObject({
    topic: "video_narrative",
    subjectId: videoSubject,
    evidenceKind: "interpretation",
  });
  expect(result.result).toMatchObject({
    coverage: "partial",
    costUsd: null,
    costStatus: "unknown",
  });
  expect(result.result.content).toMatchObject({
    channel: { id: "label-channel" },
    identity: { creditedArtists: [{ subjectId: artist }] },
    originalSongLyrics: "not_established",
  });
  expect(result.reusedArtistDocuments).toEqual([document]);
  expect(deps.readArtistDocuments).toHaveBeenCalledWith(owner, [artist]);
  expect(deps.authorize).toHaveBeenCalledTimes(2);
  expect(result.result.content).toMatchObject({ artistBrand: "not_established" });
  expect(deps.authorize).toHaveBeenNthCalledWith(1, owner, owner);
  expect(deps.authorize).toHaveBeenNthCalledWith(2, owner, owner);
  expect(deps.authorize.mock.invocationCallOrder[0]).toBeLessThan(
    deps.readRequest.mock.invocationCallOrder[0],
  );
  expect(deps.readRequest.mock.invocationCallOrder[0]).toBeLessThan(
    deps.readEvidence.mock.invocationCallOrder[0],
  );
  expect(deps.readEvidence.mock.invocationCallOrder[0]).toBeLessThan(
    deps.readArtistDocuments.mock.invocationCallOrder[0],
  );
  expect(deps.readArtistDocuments.mock.invocationCallOrder[0]).toBeLessThan(
    deps.authorize.mock.invocationCallOrder[1],
  );
  expect(JSON.stringify(result.module)).not.toContain('"topic":"artist_brand"');
});
it.each(["live", "remix", "dubbed", "unknown"])(
  "preserves %s version and never promotes captions to original lyrics",
  async variant => {
    const { evidence, deps } = fixture();
    evidence.variant = variant;
    const result = await prepare(deps);
    expect(result.result.coverage).toBe("partial");
    expect(result.result.content).toMatchObject({ variant, originalSongLyrics: "not_established" });
    expect(result.module.topic).not.toBe("lyrics");
  },
);
it("keeps unresolved identity separate from uploader and never requests artist research", async () => {
  const { evidence, deps } = fixture();
  Object.assign(evidence, { identity: { state: "unresolved", reason: "Ambiguous recording" } });
  const result = await prepare(deps);
  expect(result.result.content).toMatchObject({ identity: { state: "unresolved" } });
  expect(result.reusedArtistDocuments).toEqual([]);
  expect(deps.readArtistDocuments).not.toHaveBeenCalled();
});
it("retains multilingual captions and exact disjoint analyzed ranges without claiming full coverage", async () => {
  const { evidence, deps } = fixture();
  evidence.analysis.ranges.push({
    startSeconds: 90,
    endSeconds: 100,
    observations: ["A doorway"],
    interpretation: "An uncertain ending",
  });
  const result = await prepare(deps);
  expect(result.result.content).toMatchObject({
    captions: evidence.captions,
    analysis: evidence.analysis,
  });
  expect(result.result.coverage).toBe("partial");
});
it("preserves metadata when captions and analysis are unavailable", async () => {
  const { evidence, deps } = fixture();
  Object.assign(evidence, {
    captions: { state: "missing", reason: "No captions" },
    analysis: { state: "unavailable", reason: "No analyzed frames" },
  });
  const result = await prepare(deps);
  expect(result.result.content).toMatchObject({
    description: evidence.description,
    captions: { state: "missing" },
    analysis: { state: "unavailable" },
  });
});
it.each(["ownerId", "requestId", "videoId"])(
  "rejects wrong %s binding before reuse",
  async field => {
    const { evidence, deps } = fixture();
    Object.assign(evidence, { [field]: field === "videoId" ? "12345678901" : recording });
    await expect(prepare(deps)).rejects.toThrow();
    expect(deps.readArtistDocuments).not.toHaveBeenCalled();
  },
);
it("rejects references outside retained source versions and mismatched media versions", async () => {
  const { evidence, deps } = fixture();
  evidence.analysis.sourceVersionIds = [recording];
  await expect(prepare(deps)).rejects.toThrow();
  evidence.analysis.sourceVersionIds = [sourceId];
  evidence.sources[0].mediaVersion = "other-version";
  await expect(prepare(deps)).rejects.toThrow();
});
it("rejects an analyzed range outside the video", async () => {
  const { evidence, deps } = fixture();
  evidence.analysis.ranges[0].endSeconds = 181;
  await expect(prepare(deps)).rejects.toThrow();
});
it("excludes wrong-owner, wrong-artist, withdrawn and brand documents from reuse", async () => {
  const { deps } = fixture();
  deps.readArtistDocuments.mockResolvedValue({
    documents: [
      { ...document, ownerId: recording },
      { ...document, subjectId: recording },
      { ...document, status: "withdrawn" },
      { ...document, topic: "artist_brand" },
    ],
    withdrawnSourceVersionIds: [],
  });
  expect((await prepare(deps)).reusedArtistDocuments).toEqual([]);
  deps.readArtistDocuments.mockResolvedValue({
    documents: [document],
    withdrawnSourceVersionIds: [sourceId],
  });
  expect((await prepare(deps)).reusedArtistDocuments).toEqual([]);
});
it("stops before evidence reads on denied access and rechecks before returning", async () => {
  const { deps } = fixture();
  deps.authorize.mockRejectedValueOnce(new Error("Denied"));
  await expect(prepare(deps)).rejects.toThrow("Denied");
  expect(deps.readRequest).not.toHaveBeenCalled();
  expect(deps.readEvidence).not.toHaveBeenCalled();
  deps.authorize.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("Revoked"));
  await expect(prepare(deps)).rejects.toThrow("Revoked");
});
it("rejects cancelled requests and non-video input", async () => {
  const { deps } = fixture();
  deps.readRequest.mockResolvedValueOnce({
    id: requestId,
    owner_id: owner,
    created_by: owner,
    input: { url },
    status: "cancelled",
  });
  await expect(prepare(deps)).rejects.toThrow();
  deps.readRequest.mockResolvedValueOnce({
    id: requestId,
    owner_id: owner,
    created_by: owner,
    input: { url: "https://open.spotify.com/track/1234567890123456789012" },
    status: "partial",
  });
  await expect(prepare(deps)).rejects.toThrow();
});

it("reuses both credited collaborators without promoting their channel or performer to artist", async () => {
  const { evidence, deps } = fixture();
  const collaborator = "88888888-8888-4888-8888-888888888888";
  evidence.identity.creditedArtists.push({ subjectId: collaborator, name: "Collaborator" });
  deps.readArtistDocuments.mockResolvedValue({
    documents: [document, { ...document, id: collaborator, subjectId: collaborator }],
    withdrawnSourceVersionIds: [],
  });
  const before = JSON.stringify(evidence);
  const result = await prepare(deps);
  expect(deps.readArtistDocuments).toHaveBeenCalledWith(owner, [artist, collaborator]);
  expect(result.reusedArtistDocuments).toHaveLength(2);
  expect(JSON.stringify(evidence)).toBe(before);
});
it("preserves caption formatting and rejects empty interpretation", async () => {
  const { evidence, deps } = fixture();
  evidence.captions.segments[0].text = "  Synthetic\ncaption  ";
  expect((await prepare(deps)).result.content).toMatchObject({
    captions: {
      segments: [expect.objectContaining({ text: "  Synthetic\ncaption  " }), expect.anything()],
    },
  });
  evidence.analysis.ranges[0].interpretation = "\u200b ";
  await expect(prepare(deps)).rejects.toThrow();
});
it("rejects video subject masquerading as an artist or recording", async () => {
  const { evidence, deps } = fixture();
  evidence.identity.creditedArtists[0].subjectId = videoSubject;
  await expect(prepare(deps)).rejects.toThrow();
});
it("does not hide errors from the retained-evidence reader", async () => {
  const { deps } = fixture();
  deps.readEvidence.mockRejectedValue(new Error("Retention unavailable"));
  await expect(prepare(deps)).rejects.toThrow("Retention unavailable");
  expect(deps.readArtistDocuments).not.toHaveBeenCalled();
});

it("uses an existing shared source kind and exact media-version bytes", async () => {
  const { evidence, deps } = fixture();
  expect((await prepare(deps)).module.sources).toEqual([
    {
      url,
      kind: "provider_metadata",
      content: evidence.sources[0],
    },
  ]);
  evidence.sources[0].mediaVersion = " upload-v1 ";
  await expect(prepare(deps)).rejects.toThrow();
});

it("rejects case aliases of the same video, recording or credited artist identity", async () => {
  const { evidence, deps } = fixture();
  const mixedId = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
  evidence.videoSubjectId = mixedId;
  evidence.identity.creditedArtists[0].subjectId = mixedId.toUpperCase();
  await expect(prepare(deps)).rejects.toThrow();
  evidence.identity.creditedArtists[0].subjectId = artist;
  evidence.identity.recordingSubjectId = mixedId.toUpperCase();
  await expect(prepare(deps)).rejects.toThrow();
  evidence.identity.recordingSubjectId = recording;
  evidence.identity.creditedArtists = [
    { subjectId: mixedId, name: "One" },
    { subjectId: mixedId.toUpperCase(), name: "Duplicate" },
  ];
  evidence.videoSubjectId = videoSubject;
  await expect(prepare(deps)).rejects.toThrow();
});
it("rejects duplicate retained source UUID aliases", async () => {
  const { evidence, deps } = fixture();
  const mixedId = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
  evidence.sources.push(
    { ...evidence.sources[0], versionId: mixedId },
    { ...evidence.sources[0], versionId: mixedId.toUpperCase() },
  );
  await expect(prepare(deps)).rejects.toThrow();
});

it("reuses case-equivalent artist UUIDs without rewriting saved document references", async () => {
  const { evidence, deps } = fixture();
  const mixedId = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
  evidence.identity.creditedArtists[0].subjectId = mixedId.toUpperCase();
  const original = { ...document, subjectId: mixedId };
  deps.readArtistDocuments.mockResolvedValue({
    documents: [original],
    withdrawnSourceVersionIds: [],
  });
  expect((await prepare(deps)).reusedArtistDocuments).toEqual([original]);
});
it("excludes source withdrawal case aliases", async () => {
  const { deps } = fixture();
  const mixedId = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
  deps.readArtistDocuments.mockResolvedValue({
    documents: [{ ...document, sourceVersionIds: [mixedId] }],
    withdrawnSourceVersionIds: [mixedId.toUpperCase()],
  });
  expect((await prepare(deps)).reusedArtistDocuments).toEqual([]);
});

it("canonicalizes request/owner/actor and credited artist UUIDs before reader calls", async () => {
  const { evidence, deps } = fixture();
  const account = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
  const request = "bcdefabc-bcde-4bcd-8bcd-bcdefabcdefa";
  const credited = "cdefabcd-cdef-4cde-8cde-cdefabcdefab";
  evidence.ownerId = account.toUpperCase();
  evidence.requestId = request.toUpperCase();
  evidence.identity.creditedArtists[0].subjectId = credited.toUpperCase();
  deps.readRequest.mockResolvedValue({
    id: request,
    owner_id: account,
    created_by: account,
    input: { url },
    status: "partial",
  });
  await prepareContextVideoEvidence(
    account.toUpperCase(),
    account.toUpperCase(),
    request.toUpperCase(),
    deps,
  );
  expect(deps.authorize).toHaveBeenNthCalledWith(1, account, account);
  expect(deps.authorize).toHaveBeenNthCalledWith(2, account, account);
  expect(deps.readRequest).toHaveBeenCalledWith(account, request);
  expect(deps.readEvidence).toHaveBeenCalledWith(account, request);
  expect(deps.readArtistDocuments).toHaveBeenCalledWith(account, [credited]);
});
it.each(["\u0000", "\u0001", "\ud800", "\udfff"])(
  "rejects malformed retained text %j without sanitizing it",
  async invalid => {
    for (const field of ["title", "description", "language"]) {
      const { evidence, deps } = fixture();
      if (field === "language") evidence.captions.segments[0].language = "en" + invalid;
      else Object.assign(evidence, { [field]: "retained" + invalid });
      await expect(prepare(deps)).rejects.toThrow();
    }
  },
);

it("preserves the complete shared projection and exact original research object after extraction", async () => {
  const { evidence, deps } = fixture();
  const original = { ...document };
  deps.readArtistDocuments.mockResolvedValue({
    documents: [original],
    withdrawnSourceVersionIds: [],
  });
  const prepared = await prepare(deps);
  expect(prepared.module).toEqual({
    key: "video-narrative-fixture-v1",
    topic: "video_narrative",
    subjectId: videoSubject,
    provider: "retained-evidence",
    model: "none",
    evidenceKind: "interpretation",
    input: evidence,
    sources: [{ url, kind: "provider_metadata", content: evidence.sources[0] }],
  });
  expect(prepared.result).toEqual({
    content: {
      ...evidence,
      originalSongLyrics: "not_established",
      scope: "video_only",
      artistBrand: "not_established",
    },
    coverage: "partial",
    costUsd: null,
    costStatus: "unknown",
    trace: { method: "retained_video_projection", sourceVersionIds: [sourceId] },
  });
  expect(prepared.reusedArtistDocuments[0]).toBe(original);
});
it("keeps participant, language and retained-text limits unchanged", async () => {
  for (const mutate of [
    (evidence: ReturnType<typeof fixture>["evidence"]) => {
      evidence.title = "x".repeat(4001);
    },
    (evidence: ReturnType<typeof fixture>["evidence"]) => {
      evidence.description = "x".repeat(20001);
    },
    (evidence: ReturnType<typeof fixture>["evidence"]) => {
      evidence.captions.segments[0].language = "x".repeat(101);
    },
    (evidence: ReturnType<typeof fixture>["evidence"]) => {
      evidence.performers = Array.from({ length: 51 }, () => evidence.performers[0]);
    },
  ]) {
    const { evidence, deps } = fixture();
    mutate(evidence);
    await expect(prepare(deps)).rejects.toThrow();
  }
});
