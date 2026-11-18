import { describe, expect, it } from "vitest";
import { buildPackLyricTimeline } from "../buildPackLyricTimeline";
import { verifiedLyricAlignmentFixture } from "./fixtures/verifiedLyricAlignment";

describe("internal verified Pack lyric timeline", () => {
  it("clips source words to a nonzero excerpt, preserving gaps, bindings and original times", () => {
    const input = verifiedLyricAlignmentFixture();
    const before = structuredClone(input);
    const result = buildPackLyricTimeline(input);
    expect(result).toEqual({
      status: "ready",
      target: input.expected,
      typography: "portrait-word-v1",
      alignment: {
        revision: input.alignment.revision,
        evidenceRef: input.alignment.evidenceRef,
        verificationRef: input.alignment.verificationRef,
        verifiedRange: input.alignment.verifiedRange,
      },
      cues: [
        { text: "Soft", startMs: 0, endMs: 500, sourceStartMs: 4500, sourceEndMs: 5500 },
        { text: "sparks", startMs: 1000, endMs: 1500, sourceStartMs: 6000, sourceEndMs: 6500 },
        { text: "rise", startMs: 2500, endMs: 3000, sourceStartMs: 7500, sourceEndMs: 8500 },
      ],
    });
    expect(input).toEqual(before);
    if (result.status !== "ready") throw new Error("Expected a ready fixture timeline");
    result.alignment.verifiedRange.startMs = 123;
    expect(input.alignment.verifiedRange).toEqual(before.alignment.verifiedRange);
    input.expected.recording.sha256 = "b".repeat(64);
    expect(result.target.recording.sha256).toBe("a".repeat(64));
  });
  it("excludes words ending at excerpt start or starting at excerpt end", () => {
    const input = verifiedLyricAlignmentFixture();
    input.alignment.words = [
      { text: "before", startMs: 4000, endMs: 5000 },
      { text: "after", startMs: 8000, endMs: 9000 },
    ];
    expect(buildPackLyricTimeline(input)).toMatchObject({
      status: "gap",
      reason: "no_aligned_words",
    });
  });
  it.each([undefined, null])("reports missing alignment explicitly (%s)", alignment => {
    expect(buildPackLyricTimeline({ ...verifiedLyricAlignmentFixture(), alignment })).toMatchObject(
      {
        status: "gap",
        reason: "missing_verified_alignment",
      },
    );
  });
  it("validates the expected target even without alignment", () => {
    const input = verifiedLyricAlignmentFixture();
    input.expected.excerpt.endMs = input.expected.excerpt.startMs;
    expect(() => buildPackLyricTimeline({ ...input, alignment: null })).toThrow();
  });
  it.each(["jobId", "assetId", "jobRevision", "assetAttempt"] as const)("rejects stale %s", key => {
    const input = verifiedLyricAlignmentFixture();
    const target = input.alignment.target;
    if (key === "jobId" || key === "assetId") target[key] = "33333333-3333-4333-8333-333333333333";
    else target[key]++;
    expect(() => buildPackLyricTimeline(input)).toThrow();
  });
  it.each(["storageKey", "sha256", "durationMs"] as const)(
    "rejects mismatched recording %s",
    key => {
      const input = verifiedLyricAlignmentFixture();
      const recording = input.alignment.target.recording;
      if (key === "durationMs") recording[key]++;
      else recording[key] = key === "sha256" ? "b".repeat(64) : "fixture/different.wav";
      expect(() => buildPackLyricTimeline(input)).toThrow();
    },
  );
  it.each(["startMs", "endMs"] as const)("rejects stale excerpt %s", key => {
    const input = verifiedLyricAlignmentFixture();
    input.alignment.target.excerpt[key]++;
    expect(() => buildPackLyricTimeline(input)).toThrow();
  });
  it.each([-1, 0, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid duration %s",
    durationMs => {
      const input = verifiedLyricAlignmentFixture();
      input.expected.recording.durationMs = durationMs;
      expect(() => buildPackLyricTimeline(input)).toThrow();
    },
  );
  it.each([-1, 1.5, NaN, Infinity])("rejects invalid word time %s", startMs => {
    const input = verifiedLyricAlignmentFixture();
    input.alignment.words[0].startMs = startMs;
    expect(() => buildPackLyricTimeline(input)).toThrow();
  });
  it.each([
    "zero",
    "reversed",
    "unordered",
    "overlap",
    "outside",
    "uncovered",
    "rangeBeyondRecording",
    "excerptBeyondRecording",
  ])("rejects %s timing", kind => {
    const input = verifiedLyricAlignmentFixture();
    const words = input.alignment.words;
    if (kind === "zero") words[0].endMs = words[0].startMs;
    if (kind === "reversed") words[0].endMs = words[0].startMs - 1;
    if (kind === "unordered") words.reverse();
    if (kind === "overlap") words[1].startMs = 5000;
    if (kind === "outside") words[2].endMs = 20001;
    if (kind === "uncovered") input.alignment.verifiedRange.startMs = 5001;
    if (kind === "rangeBeyondRecording") input.alignment.verifiedRange.endMs = 20001;
    if (kind === "excerptBeyondRecording") input.expected.excerpt.endMs = 20001;
    expect(() => buildPackLyricTimeline(input)).toThrow();
  });
  it("accepts adjacent half-open words and exact recording/excerpt boundaries", () => {
    const input = verifiedLyricAlignmentFixture();
    input.expected.excerpt = { startMs: 0, endMs: 20000 };
    input.alignment.target = structuredClone(input.expected);
    input.alignment.words = [
      { text: "a", startMs: 0, endMs: 10000 },
      { text: "b", startMs: 10000, endMs: 20000 },
    ];
    expect(buildPackLyricTimeline(input)).toMatchObject({
      status: "ready",
      cues: [
        { startMs: 0, endMs: 10000 },
        { startMs: 10000, endMs: 20000 },
      ],
    });
  });
  it.each(["", " ", "unknown", "N/A", "none", "unverified", "\u200b", "\u0000", "\ud800"])(
    "rejects unusable verification reference %j",
    verificationRef => {
      const input = verifiedLyricAlignmentFixture();
      input.alignment.verificationRef = verificationRef;
      expect(() => buildPackLyricTimeline(input)).toThrow();
    },
  );
  it("does not accept a self-asserted verified boolean or unknown properties", () => {
    const input = verifiedLyricAlignmentFixture();
    expect(() =>
      buildPackLyricTimeline({ ...input, alignment: { ...input.alignment, verified: true } }),
    ).toThrow();
    expect(() => buildPackLyricTimeline({ ...input, ownerId: "untrusted" })).toThrow();
    const { verificationRef: _unused, ...alignment } = input.alignment;
    expect(() => buildPackLyricTimeline({ ...input, alignment })).toThrow();
  });
  it.each([" café ", "e\u0301", "\u0301", "你好", "مرحبا", "👩‍🎤", '<b>{\\k20}%:&"\'"</b>'])(
    "preserves literal Unicode text %j",
    text => {
      const input = verifiedLyricAlignmentFixture();
      input.alignment.words[0].text = text;
      expect(buildPackLyricTimeline(input)).toMatchObject({
        status: "ready",
        cues: [{ text }, {}, {}],
      });
    },
  );
  it.each([
    "",
    " ",
    "\u200b",
    "\u200d",
    "\u034f",
    "a\n",
    "a\r",
    "a\t",
    "a\u0000",
    "a\u007f",
    "a\u2028",
    "a\u2029",
    "a\u202e",
    "a\u2066",
    "a\ud800",
    "a\udc00",
  ])("rejects unsafe or empty word %j", text => {
    const input = verifiedLyricAlignmentFixture();
    input.alignment.words[0].text = text;
    expect(() => buildPackLyricTimeline(input)).toThrow();
  });
  it("rejects arbitrary typography instructions", () => {
    expect(() =>
      buildPackLyricTimeline({
        ...verifiedLyricAlignmentFixture(),
        typography: "fontfile=/etc/passwd",
      }),
    ).toThrow();
  });
  it("bounds code points without rejecting valid astral pairs", () => {
    const input = verifiedLyricAlignmentFixture();
    input.alignment.words[0].text = "🎵".repeat(128);
    expect(buildPackLyricTimeline(input).status).toBe("ready");
    input.alignment.words[0].text += "a";
    expect(() => buildPackLyricTimeline(input)).toThrow();
  });
  it("enforces internal clip/recording bounds at exact limits", () => {
    const input = verifiedLyricAlignmentFixture();
    input.expected.recording.durationMs = 1200000;
    input.expected.excerpt = { startMs: 1140000, endMs: 1200000 };
    input.alignment.target = structuredClone(input.expected);
    input.alignment.verifiedRange = { startMs: 0, endMs: 1200000 };
    input.alignment.words = [{ text: "a", startMs: 1140000, endMs: 1200000 }];
    expect(buildPackLyricTimeline(input).status).toBe("ready");
    input.expected.excerpt.startMs--;
    expect(() => buildPackLyricTimeline(input)).toThrow();
    input.expected.excerpt.startMs++;
    input.expected.recording.durationMs++;
    expect(() => buildPackLyricTimeline(input)).toThrow();
  });
  it("bounds word count and permits verified silence as an explicit gap", () => {
    const input = verifiedLyricAlignmentFixture();
    input.alignment.words = Array.from({ length: 1000 }, (_, n) => ({
      text: "a",
      startMs: n,
      endMs: n + 1,
    }));
    expect(buildPackLyricTimeline(input)).toMatchObject({
      status: "gap",
      reason: "no_aligned_words",
    });
    input.alignment.words.push({ text: "a", startMs: 1000, endMs: 1001 });
    expect(() => buildPackLyricTimeline(input)).toThrow();
    input.alignment.words = [];
    expect(buildPackLyricTimeline(input)).toMatchObject({
      status: "gap",
      reason: "no_aligned_words",
    });
  });
  it("bounds total UTF-8 bytes including outside-excerpt evidence", () => {
    const input = verifiedLyricAlignmentFixture();
    input.alignment.words = Array.from({ length: 128 }, (_, n) => ({
      text: "🎵".repeat(128),
      startMs: n,
      endMs: n + 1,
    }));
    expect(buildPackLyricTimeline(input).status).toBe("gap");
    input.alignment.words.push({ text: "a", startMs: 128, endMs: 129 });
    expect(() => buildPackLyricTimeline(input)).toThrow();
  });
});
