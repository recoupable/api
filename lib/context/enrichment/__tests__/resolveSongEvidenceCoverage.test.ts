import { describe, expect, it } from "vitest";
import { contextCoverageSchema } from "../../schema";
import { resolveSongEvidenceCoverage } from "../resolveSongEvidenceCoverage";
const verified = {
  durationSeconds: 152.23,
  verification: {
    method: "waveform-cross-correlation",
    correlation: 0.986,
    previewSeconds: 29.713,
    offsetSeconds: 96.064,
  },
};
describe("resolveSongEvidenceCoverage", () => {
  it("labels verified full audio as full with the complete matched range", () => {
    const result = resolveSongEvidenceCoverage({ audioSource: verified });
    expect(result.label).toBe("full");
    expect(result.persistedCoverage).toBe("full");
    expect(result.coverage).toEqual({
      extent: "full",
      identity: "matched",
      durationSeconds: 152.23,
      startSeconds: 0,
      endSeconds: 152.23,
      language: null,
    });
  });
  it("labels a preview excerpt as partial and uncertain without inventing the full duration", () => {
    const result = resolveSongEvidenceCoverage({ audioSource: null, previewDurationSeconds: 30 });
    expect(result.label).toBe("preview");
    expect(result.persistedCoverage).toBe("partial");
    expect(result.coverage).toMatchObject({
      extent: "partial",
      identity: "uncertain",
      durationSeconds: null,
      startSeconds: 0,
      endSeconds: 30,
    });
    expect(
      resolveSongEvidenceCoverage({
        audioSource: null,
        previewDurationSeconds: 30,
        expectedDurationSeconds: 180,
      }).coverage.durationSeconds,
    ).toBe(180);
  });
  it("labels audio whose duration disagrees with the recording as a wrong recording", () => {
    const result = resolveSongEvidenceCoverage({
      audioSource: verified,
      expectedDurationSeconds: 210,
    });
    expect(result.label).toBe("wrong_recording");
    expect(result.persistedCoverage).toBe("unknown");
    expect(result.coverage).toMatchObject({
      extent: "unavailable",
      identity: "mismatch",
      startSeconds: null,
      endSeconds: null,
    });
  });
  it("does not accept audio without waveform verification as the recording", () => {
    const result = resolveSongEvidenceCoverage({
      audioSource: { durationSeconds: 152.23, verification: null },
    });
    expect(result.label).toBe("wrong_recording");
    expect(result.coverage.extent).toBe("unavailable");
    expect(result.coverage.identity).toBe("uncertain");
  });
  it("labels missing audio as unavailable and unknown with no range", () => {
    const result = resolveSongEvidenceCoverage({ audioSource: null });
    expect(result.label).toBe("missing");
    expect(result.persistedCoverage).toBe("unknown");
    expect(result.coverage).toEqual({
      extent: "unavailable",
      identity: "unknown",
      durationSeconds: null,
      startSeconds: null,
      endSeconds: null,
      language: null,
    });
  });
  it("passes a multilingual language label through verbatim and never guesses one", () => {
    const multilingual = resolveSongEvidenceCoverage({
      audioSource: verified,
      language: "multilingual: en, es",
    });
    expect(multilingual.label).toBe("full");
    expect(multilingual.coverage.language).toBe("multilingual: en, es");
    expect(resolveSongEvidenceCoverage({ audioSource: verified }).coverage.language).toBeNull();
    expect(
      resolveSongEvidenceCoverage({ audioSource: verified, language: "  " }).coverage.language,
    ).toBeNull();
  });
  it("returns schema-valid coverage for every label", () => {
    for (const input of [
      { audioSource: verified },
      { audioSource: null, previewDurationSeconds: 30, expectedDurationSeconds: 180 },
      { audioSource: verified, expectedDurationSeconds: 210 },
      { audioSource: null },
      { audioSource: null, previewDurationSeconds: 45, expectedDurationSeconds: 30 },
    ]) {
      const { coverage } = resolveSongEvidenceCoverage(input);
      expect(contextCoverageSchema.safeParse(coverage).success).toBe(true);
    }
  });
});
