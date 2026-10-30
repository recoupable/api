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

const purposeTopics = {
  creative_direction: [
    "song_summary",
    "lyrics",
    "artwork_branding",
    "artist_research",
    "recording_metadata",
    "release_metadata",
    "artist_metadata",
  ],
  playlist_pitch: [
    "catalog_metadata",
    "song_summary",
    "artist_research",
    "recording_metadata",
    "release_metadata",
    "artist_metadata",
  ],
  company_onboarding: [
    "company_input",
    "songwriter_input",
    "artist_metadata",
    "catalog_metadata",
    "recording_metadata",
    "release_metadata",
    "release_locator",
  ],
} as const;

it.each(Object.keys(purposeTopics) as (keyof typeof purposeTopics)[])(
  "%s excludes blank claims from coverage and the input manifest",
  purpose => {
    const topics = purposeTopics[purpose];
    for (const text of ["", " \t\r\n", "\u00a0\u2003"]) {
      const result = compileContextBrief({
        ownerId: "owner",
        requests: [{ id: "first", subjectIds: ["subject"] }],
        documents: topics.map(topic => ({ ...document("subject", topic), text })),
        purpose,
        maxCharacters: 12000,
      });
      expect(result.readiness).toBe("partial");
      expect(result.documents).toEqual([]);
      expect(result.input_manifest.documents).toEqual([]);
      expect(result.characters).toBe(0);
      expect(result.missingTopics).toEqual(topics);
      expect(result.request_coverage[0].missingTopics).toEqual(topics);
      expect(result.gaps).toHaveLength(topics.length);
      expect(result.text).toContain("Included evidence: 0 documents.");
      expect(result.text).not.toContain("All selected saved requests have");
    }
  },
);

it("retains complete nonempty evidence verbatim beside blank evidence", () => {
  const text = "  A tentative interpretation.\nThe final qualifier remains unconfirmed.  ";
  const result = compileContextBrief({
    ownerId: "owner",
    requests: [{ id: "first", subjectIds: ["subject"] }],
    documents: [
      { ...document("subject", "song_summary"), text },
      { ...document("subject", "artist_research"), text: " \n " },
    ],
    purpose: "playlist_pitch",
    maxCharacters: 1000,
  });
  expect(result.documents).toHaveLength(1);
  expect(result.documents[0].text).toBe(text);
  expect(result.input_manifest.documents.map(doc => doc.topic)).toEqual(["song_summary"]);
  expect(result.missingTopics).toContain("artist_research");
  expect(result.missingTopics).not.toContain("song_summary");
  expect(result.text).toContain("The final qualifier remains unconfirmed.");
  expect(result.text.length).toBeLessThanOrEqual(1000);
});
