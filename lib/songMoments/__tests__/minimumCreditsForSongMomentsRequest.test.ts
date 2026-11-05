import { describe, it, expect } from "vitest";
import { minimumCreditsForSongMomentsRequest } from "../minimumCreditsForSongMomentsRequest";

describe("minimumCreditsForSongMomentsRequest", () => {
  it("gates on the measurement plus a model base fee for each of the seven moment types", () => {
    // $0.01 measurement + 7 × $0.05 model base.
    expect(minimumCreditsForSongMomentsRequest({ describe: true })).toBe(360_000);
  });

  it("gates on the measurement alone when nothing is described", () => {
    expect(minimumCreditsForSongMomentsRequest({ describe: false })).toBe(10_000);
  });

  it("gates on the listed moments only", () => {
    expect(minimumCreditsForSongMomentsRequest({ describe: ["vocal_hook", "climax"] })).toBe(
      110_000,
    );
  });
});
