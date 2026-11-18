import { describe, it, expect } from "vitest";
import { buildPackLyricRenderPlan } from "../buildPackLyricRenderPlan";
import { verifiedLyricAlignmentFixture } from "./fixtures/verifiedLyricAlignment";
const renderer = "a".repeat(64);
describe("local lyric render plan", () => {
  it("maps half-open millisecond cues to a zero-based 30fps grid", () => {
    const input = verifiedLyricAlignmentFixture();
    const plan = buildPackLyricRenderPlan(input, 5, 3, renderer);
    expect(plan.cues.map(c => [c.startFrame, c.endFrame])).toEqual([
      [0, 15],
      [30, 45],
      [75, 90],
    ]);
    expect(plan.frames).toBe(90);
    expect(plan.startSeconds).toBe("5.000");
    expect(plan.durationSeconds).toBe("3.000");
  });
  it("binds literal words, provenance and renderer identity, not object property ordering", () => {
    const input = verifiedLyricAlignmentFixture();
    const original = buildPackLyricRenderPlan(input, 5, 3, renderer);
    expect(
      buildPackLyricRenderPlan(
        { typography: input.typography, alignment: input.alignment, expected: input.expected },
        5,
        3,
        renderer,
      ).digest,
    ).toBe(original.digest);
    input.alignment.words[0].text = "Other";
    expect(buildPackLyricRenderPlan(input, 5, 3, renderer).digest).not.toBe(original.digest);
    input.alignment.verificationRef = "fixture:other-proof";
    expect(buildPackLyricRenderPlan(input, 5, 3, renderer).digest).not.toBe(original.digest);
    expect(buildPackLyricRenderPlan(input, 5, 3, "b".repeat(64)).digest).not.toBe(
      buildPackLyricRenderPlan(input, 5, 3, renderer).digest,
    );
  });
  it.each([NaN, Infinity, -1, 5.0001, 4.999, 6])("rejects invalid/mismatched start %s", start => {
    expect(() =>
      buildPackLyricRenderPlan(verifiedLyricAlignmentFixture(), start, 3, renderer),
    ).toThrow();
  });
  it("allows binary representation noise only", () => {
    expect(
      buildPackLyricRenderPlan(verifiedLyricAlignmentFixture(), 5 + Number.EPSILON, 3, renderer)
        .frames,
    ).toBe(90);
  });
  it("rejects missing alignment and zero-frame words", () => {
    const input = verifiedLyricAlignmentFixture();
    expect(() => buildPackLyricRenderPlan({ ...input, alignment: null }, 5, 3, renderer)).toThrow();
    input.alignment.words = [{ text: "tiny", startMs: 5001, endMs: 5002 }];
    expect(() => buildPackLyricRenderPlan(input, 5, 3, renderer)).toThrow(/resolution/);
  });
  it.each(["é", "中", "👩‍🎤", "e\u0301"])("refuses unqualified glyphs %s", text => {
    const input = verifiedLyricAlignmentFixture();
    input.alignment.words[0].text = text;
    expect(() => buildPackLyricRenderPlan(input, 5, 3, renderer)).toThrow(/glyph/);
  });
  it("keeps syntax-looking text literal", () => {
    const input = verifiedLyricAlignmentFixture();
    input.alignment.words[0].text = "%{expr:1+1} {\\k20} <b>&</b>";
    expect(buildPackLyricRenderPlan(input, 5, 3, renderer).cues[0].text).toBe(
      input.alignment.words[0].text,
    );
  });
});
