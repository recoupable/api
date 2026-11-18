/** Original synthetic words and fictional verification references: never real alignment evidence. */
export function verifiedLyricAlignmentFixture() {
  const expected = {
    jobId: "11111111-1111-4111-8111-111111111111",
    jobRevision: 2,
    assetId: "22222222-2222-4222-8222-222222222222",
    assetAttempt: 1,
    recording: { storageKey: "fixture/original.wav", sha256: "a".repeat(64), durationMs: 20_000 },
    excerpt: { startMs: 5_000, endMs: 8_000 },
  };
  return {
    expected,
    typography: "portrait-word-v1" as const,
    alignment: {
      target: structuredClone(expected),
      revision: "fixture-alignment-v1",
      evidenceRef: "fixture:original-word-alignment",
      verificationRef: "fixture:human-checked-original-words-and-timing",
      verifiedRange: { startMs: 0, endMs: 20_000 },
      words: [
        { text: "Soft", startMs: 4_500, endMs: 5_500 },
        { text: "sparks", startMs: 6_000, endMs: 6_500 },
        { text: "rise", startMs: 7_500, endMs: 8_500 },
      ],
    },
  };
}
