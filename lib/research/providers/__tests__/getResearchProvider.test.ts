import { describe, expect, it, afterEach } from "vitest";

import { getResearchProvider } from "../getResearchProvider";

const ORIGINAL_PROVIDER = process.env.RESEARCH_PROVIDER;

describe("getResearchProvider", () => {
  afterEach(() => {
    process.env.RESEARCH_PROVIDER = ORIGINAL_PROVIDER;
  });

  it("defaults research to SongStats", () => {
    delete process.env.RESEARCH_PROVIDER;

    expect(getResearchProvider()).toBe("songstats");
  });

  it("preserves Chartmetric when explicitly configured as the legacy provider", () => {
    process.env.RESEARCH_PROVIDER = "chartmetric";

    expect(getResearchProvider()).toBe("chartmetric");
  });

  it("falls back to SongStats for unrecognized provider values", () => {
    process.env.RESEARCH_PROVIDER = "unknown";

    expect(getResearchProvider()).toBe("songstats");
  });
});
