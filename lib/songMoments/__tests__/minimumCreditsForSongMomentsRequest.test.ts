import { describe, it, expect } from "vitest";
import { minimumCreditsForSongMomentsRequest } from "../minimumCreditsForSongMomentsRequest";

describe("minimumCreditsForSongMomentsRequest", () => {
  it("gates on the measurement plus one model base fee, since every moment is one batch", () => {
    // $0.01 measurement + $0.05 model base.
    expect(minimumCreditsForSongMomentsRequest({ describe: true })).toBe(60_000);
    expect(minimumCreditsForSongMomentsRequest({ describe: ["vocal_hook", "climax"] })).toBe(
      60_000,
    );
  });

  it("gates on the measurement alone when nothing is described", () => {
    expect(minimumCreditsForSongMomentsRequest({ describe: false })).toBe(10_000);
    expect(minimumCreditsForSongMomentsRequest({ describe: [] })).toBe(10_000);
  });
});
