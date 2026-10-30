import { expect, it } from "vitest";
import { compileContextBrief } from "../compileContextBrief";
import type { ContextBriefDocument } from "../selectContextDocuments";

const document = (subjectId: string, topic: string): ContextBriefDocument => ({
  id: `${subjectId}:${topic}`,
  ownerId: "owner",
  subjectId,
  topic,
  version: 2,
  status: "accepted",
  evidenceKind: "observation",
  text: `${subjectId} ${topic} evidence`,
  sourceVersionIds: [`${subjectId}:${topic}:source`],
  coverage: "full",
});
const requests = [
  { id: "first", subjectIds: ["song-a", "artist"] },
  { id: "second", subjectIds: ["song-b", "artist"] },
];
const documents = [
  ...["song-a", "song-b"].flatMap(song =>
    [
      "song_summary",
      "catalog_metadata",
      "lyrics",
      "artwork_branding",
      "recording_metadata",
      "release_metadata",
    ].map(topic => document(song, topic)),
  ),
  document("artist", "artist_research"),
  document("artist", "artist_metadata"),
];
const input = { ownerId: "owner", requests, documents, maxCharacters: 12000 };

it("compiles distinct briefs for two songs and includes shared artist evidence once", () => {
  const creative = compileContextBrief({ ...input, purpose: "creative_direction" });
  const pitch = compileContextBrief({ ...input, purpose: "playlist_pitch" });
  expect(creative.text).toContain("Creative-direction brief");
  expect(creative.text).toContain("song-a artwork_branding evidence");
  expect(pitch.text).toContain("Playlist-pitch brief");
  expect(pitch.text).not.toContain("artwork_branding evidence");
  expect(pitch.text).toContain("song-b catalog_metadata evidence");
  expect(creative.documents.filter(doc => doc.id === "artist:artist_research")).toHaveLength(1);
  expect(creative.readiness).toBe("ready");
  expect(creative.input_manifest.requestIds).toEqual(["first", "second"]);
  expect(creative.input_manifest.documents).toContainEqual(
    expect.objectContaining({
      documentId: "song-a:lyrics",
      version: 2,
      sourceVersionIds: ["song-a:lyrics:source"],
    }),
  );
});

it("keeps the brief partial when only one song has its required evidence", () => {
  const brief = compileContextBrief({
    ...input,
    purpose: "playlist_pitch",
    documents: documents.filter(doc => doc.subjectId !== "song-b"),
  });
  expect(brief.readiness).toBe("partial");
  expect(brief.request_coverage).toContainEqual(
    expect.objectContaining({
      requestId: "second",
      missingTopics: expect.arrayContaining(["song_summary", "catalog_metadata"]),
    }),
  );
});

it("honors the output limit and never truncates evidence or hides budget omissions", () => {
  const brief = compileContextBrief({
    ...input,
    purpose: "creative_direction",
    maxCharacters: 1000,
    documents: [{ ...document("song-a", "lyrics"), text: "x".repeat(2000) }],
  });
  expect(brief.text.length).toBeLessThanOrEqual(1000);
  expect(brief.documents).toEqual([]);
  expect(brief.readiness).toBe("partial");
  expect(brief.missingTopics).toContain("lyrics");
});

it("excludes unrelated workspace evidence and creative proposals", () => {
  const brief = compileContextBrief({
    ...input,
    purpose: "creative_direction",
    documents: [
      { ...document("song-a", "lyrics"), ownerId: "other", text: "PRIVATE" },
      {
        ...document("song-b", "artwork_branding"),
        evidenceKind: "creative_proposal",
        text: "PROPOSAL",
      },
    ],
  });
  expect(brief.text).not.toMatch(/PRIVATE|PROPOSAL/);
  expect(brief.documents).toEqual([]);
});

it.each(["company_onboarding", "creative_direction", "playlist_pitch"] as const)(
  "explains empty evidence in bounded readable %s output",
  purpose => {
    const brief = compileContextBrief({ ...input, purpose, documents: [], maxCharacters: 1000 });
    expect(brief.text).toContain("Included evidence: 0 documents.");
    expect(brief.text).toContain("Requests with missing topics or partial evidence: 2 of 2.");
    expect(brief.text.length).toBeLessThanOrEqual(1000);
  },
);

it("keeps readable coverage aligned with each request rather than global topic coverage", () => {
  const brief = compileContextBrief({
    ...input,
    purpose: "playlist_pitch",
    documents: documents.filter(doc => doc.subjectId !== "song-b"),
  });
  expect(brief.missingTopics).toEqual([]);
  expect(brief.text).toContain("Requests with missing topics or partial evidence: 1 of 2.");
  expect(brief.text).toContain(`Included evidence: ${brief.documents.length} documents.`);
});

it("reports partial evidence even when every required topic is included", () => {
  const brief = compileContextBrief({
    ...input,
    purpose: "playlist_pitch",
    documents: documents.map(doc => ({ ...doc, coverage: "partial" })),
  });
  expect(brief.missingTopics).toEqual([]);
  expect(brief.text).toContain("Requests with missing topics or partial evidence: 2 of 2.");
});

it("summarizes full coverage without claiming completeness beyond the selected requests", () => {
  const brief = compileContextBrief({ ...input, purpose: "creative_direction" });
  expect(brief.text).toContain(
    "All selected saved requests have the required topics with full coverage.",
  );
  expect(brief.text).toContain(`Included evidence: ${brief.documents.length} documents.`);
});

it("updates the summary after complete evidence is removed to fit the rendered text", () => {
  const compactInput = {
    ...input,
    purpose: "playlist_pitch" as const,
    documents: [{ ...document("song-a", "song_summary"), text: "e".repeat(500) }],
  };
  expect(compileContextBrief({ ...compactInput, maxCharacters: 2000 }).documents).toHaveLength(1);
  const brief = compileContextBrief({ ...compactInput, maxCharacters: 1000 });
  expect(brief.documents).toEqual([]);
  expect(brief.text).toContain("Included evidence: 0 documents.");
  expect(brief.text).toContain("Gaps may reflect unavailable evidence or the size limit.");
  expect(brief.text).not.toContain("e".repeat(50));
  expect(brief.text.length).toBeLessThanOrEqual(1000);
});
