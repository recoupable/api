import { describe, expect, it } from "vitest";
import { mapLegacyPlaylistScope } from "../mapLegacyPlaylistScope";

describe("mapLegacyPlaylistScope", () => {
  it("maps current to current and past to total", () => {
    expect(mapLegacyPlaylistScope("current")).toBe("current");
    expect(mapLegacyPlaylistScope("past")).toBe("total");
  });
});
