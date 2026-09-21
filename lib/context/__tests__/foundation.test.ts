import { describe, expect, it } from "vitest";
import { parseContextUrl } from "../parseContextUrl";
import { contextCoverageSchema, contextIngestSchema } from "../schema";
import { createContextReuseKey } from "../createContextReuseKey";
import { selectContextDocuments } from "../selectContextDocuments";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const input = {
  ownerId: owner,
  subjectId: "artist:example",
  topic: "artist_research",
  recipeVersion: "1",
  schemaVersion: "1",
  requiredCoverage: "full",
  sources: [
    { id: "source-a", version: "1" },
    { id: "source-b", version: "2" },
  ],
};

describe("context URL identity", () => {
  it("preserves provider ID case and removes tracking", () => {
    expect(
      parseContextUrl("https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB?si=test"),
    ).toEqual({
      provider: "spotify",
      kind: "track",
      id: "2ay96C6SLNv9urvXKD3ecB",
      url: "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB",
    });
  });
  it.each(["https://youtu.be/AbCdEfGhI_1?t=4", "https://www.youtube.com/watch?v=AbCdEfGhI_1"])(
    "normalizes a single video: %s",
    url => {
      expect(parseContextUrl(url)).toEqual({
        provider: "youtube",
        kind: "video",
        id: "AbCdEfGhI_1",
        url: "https://www.youtube.com/watch?v=AbCdEfGhI_1",
      });
    },
  );
  it.each([
    "http://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB",
    "https://open.spotify.com.evil.test/track/2ay96C6SLNv9urvXKD3ecB",
    "https://user:password@open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB",
    "https://open.spotify.com:8080/track/2ay96C6SLNv9urvXKD3ecB",
    "https://open.spotify.com/album/2ay96C6SLNv9urvXKD3ecB",
    "https://youtube.com/playlist?list=example",
    "https://youtube.com/watch?v=AbCdEfGhI_1&v=OtherIdAB_2",
    "https://youtu.be/AbCdEfGhI_1/extra",
  ])("rejects unsupported or ambiguous input: %s", url => {
    expect(() => parseContextUrl(url)).toThrow();
  });
});

describe("context contracts", () => {
  it("accepts URL-only input with server defaults", () => {
    expect(
      contextIngestSchema.parse({
        url: "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB",
        idempotency_key: "release-1",
      }),
    ).toMatchObject({ idempotency_key: "release-1" });
  });
  it("rejects caller-supplied identity and billing authority", () => {
    expect(
      contextIngestSchema.safeParse({
        url: "https://youtu.be/AbCdEfGhI_1",
        idempotency_key: "release-1",
        account_id: other,
        payer_id: other,
      }).success,
    ).toBe(false);
  });
  it("never labels an excerpt or unknown recording full", () => {
    const partial = {
      extent: "full",
      identity: "matched",
      durationSeconds: 180,
      startSeconds: 0,
      endSeconds: 30,
      language: null,
    };
    expect(contextCoverageSchema.safeParse(partial).success).toBe(false);
    expect(
      contextCoverageSchema.safeParse({ ...partial, endSeconds: 180, identity: "unknown" }).success,
    ).toBe(false);
    expect(contextCoverageSchema.safeParse({ ...partial, endSeconds: 180 }).success).toBe(true);
  });
  it("retains unknown coverage without inventing duration", () => {
    expect(
      contextCoverageSchema.parse({
        extent: "unknown",
        identity: "unknown",
        durationSeconds: null,
        startSeconds: null,
        endSeconds: null,
        language: null,
      }).durationSeconds,
    ).toBeNull();
  });
});

describe("reuse boundaries", () => {
  it("reuses the same inputs regardless of source order", () => {
    expect(createContextReuseKey(input)).toBe(
      createContextReuseKey({ ...input, sources: [...input.sources].reverse() }),
    );
  });
  it.each([
    { ownerId: other },
    { subjectId: "artist:other" },
    { topic: "song_summary" },
    { recipeVersion: "2" },
    { schemaVersion: "2" },
    { requiredCoverage: "partial" },
    { sources: [{ id: "source-a", version: "2" }] },
    { instructionVersion: "customer-correction-2" },
  ])("does not reuse incompatible input %j", change => {
    expect(createContextReuseKey(input)).not.toBe(createContextReuseKey({ ...input, ...change }));
  });
});

describe("brief evidence selection", () => {
  const document = {
    id: "doc-1",
    ownerId: owner,
    subjectId: "song:one",
    topic: "song_summary",
    version: 1,
    status: "accepted" as const,
    evidenceKind: "interpretation" as const,
    text: "An energetic song.",
    sourceVersionIds: ["source-v1"],
    coverage: "full" as const,
  };
  const request = {
    ownerId: owner,
    subjectIds: ["song:one"],
    topics: ["song_summary"],
    maxCharacters: 1000,
    requiredCoverage: "full" as const,
    withdrawnSourceVersionIds: [],
  };
  it("selects authorized accepted evidence only", () => {
    const documents = [
      document,
      { ...document, id: "private", ownerId: other },
      { ...document, id: "proposal", evidenceKind: "creative_proposal" as const },
      { ...document, id: "failed", status: "invalid" as const },
      { ...document, id: "other-song", subjectId: "song:two" },
    ];
    expect(selectContextDocuments(documents, request).documents.map(d => d.id)).toEqual(["doc-1"]);
  });
  it("excludes withdrawn evidence and incomplete coverage", () => {
    expect(
      selectContextDocuments([document], { ...request, withdrawnSourceVersionIds: ["source-v1"] })
        .documents,
    ).toEqual([]);
    expect(
      selectContextDocuments([{ ...document, coverage: "partial" }], request).missingTopics,
    ).toEqual(["song_summary"]);
  });
  it("never truncates away attribution to fit the brief", () => {
    const result = selectContextDocuments([document], { ...request, maxCharacters: 4 });
    expect(result.documents).toEqual([]);
    expect(result.missingTopics).toEqual(["song_summary"]);
  });
});
