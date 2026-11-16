import { describe, it, expect } from "vitest";
import { parseMomentDescription } from "../parseMomentDescription";

describe("parseMomentDescription", () => {
  it("reads a JSON reply", () => {
    expect(
      parseMomentDescription(
        '{"description": "Drums drop out under a held vocal.", "emotion": ["Tense", "hopeful"], "vocals": true, "best_for": ["film trailer"]}',
      ),
    ).toEqual({
      description: "Drums drop out under a held vocal.",
      emotion: ["tense", "hopeful"],
      best_for: ["film trailer"],
      vocals: true,
    });
  });

  it("reads single-quoted JSON wrapped in other text", () => {
    const parsed = parseMomentDescription(
      "Here you go: {'description': 'A big chorus.', 'emotion': ['joyful'], 'vocals': True, 'best_for': ['ad']}",
    );
    expect(parsed.description).toBe("A big chorus.");
    expect(parsed.vocals).toBe(true);
  });

  it("keeps at most three tags each", () => {
    const parsed = parseMomentDescription(
      '{"emotion": ["a", "b", "c", "d"], "best_for": ["ad", "TV promo", "sports", "video game"]}',
    );
    expect(parsed.emotion).toEqual(["a", "b", "c"]);
    expect(parsed.best_for).toEqual(["ad", "tv promo", "sports"]);
  });

  it("returns empty fields, never invented ones, for an unusable reply", () => {
    expect(parseMomentDescription("I cannot describe this.")).toEqual({
      description: null,
      emotion: [],
      best_for: [],
      vocals: null,
    });
    expect(parseMomentDescription('{"description": ')).toEqual({
      description: null,
      emotion: [],
      best_for: [],
      vocals: null,
    });
  });
});
