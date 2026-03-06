import { describe, it, expect } from "vitest";
import {
  getPreset,
  getAllPresets,
  getPresetSummaries,
  PRESET_NAMES,
} from "../presets";
import { FULL_REPORT_SECTIONS, FULL_REPORT_PRESET_NAME } from "../presets/fullReport";

describe("getPreset", () => {
  it("returns a preset config for a valid name", () => {
    const preset = getPreset("catalog_metadata");
    expect(preset).toBeDefined();
    expect(preset?.name).toBe("catalog_metadata");
    expect(preset?.prompt).toBeTruthy();
    expect(preset?.params).toBeDefined();
  });

  it("returns undefined for an invalid name", () => {
    expect(getPreset("nonexistent")).toBeUndefined();
  });

  it("returns undefined for full_report (it is a composite, not a single preset)", () => {
    expect(getPreset("full_report")).toBeUndefined();
  });
});

describe("getAllPresets", () => {
  it("returns all 13 individual presets", () => {
    const presets = getAllPresets();
    expect(presets).toHaveLength(13);
  });

  it("each preset has required fields", () => {
    for (const preset of getAllPresets()) {
      expect(preset.name).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.prompt).toBeTruthy();
      expect(preset.params.max_new_tokens).toBeGreaterThan(0);
      expect(typeof preset.params.temperature).toBe("number");
      expect(typeof preset.params.do_sample).toBe("boolean");
      expect(typeof preset.requiresAudio).toBe("boolean");
      expect(["json", "text"]).toContain(preset.responseFormat);
    }
  });
});

describe("PRESET_NAMES", () => {
  it("includes all 13 individual presets plus full_report", () => {
    expect(PRESET_NAMES).toHaveLength(14);
    expect(PRESET_NAMES).toContain("catalog_metadata");
    expect(PRESET_NAMES).toContain("full_report");
  });
});

describe("getPresetSummaries", () => {
  it("returns 14 summaries (13 individual + full_report)", () => {
    const summaries = getPresetSummaries();
    expect(summaries).toHaveLength(14);
  });

  it("includes full_report in summaries", () => {
    const summaries = getPresetSummaries();
    const fullReport = summaries.find((s) => s.name === "full_report");
    expect(fullReport).toBeDefined();
    expect(fullReport?.label).toBe("Full Report");
  });
});

describe("FULL_REPORT_SECTIONS", () => {
  it("contains 13 sections in narrative order", () => {
    expect(FULL_REPORT_SECTIONS).toHaveLength(13);
  });

  it("first section is catalog_metadata (overview)", () => {
    expect(FULL_REPORT_SECTIONS[0].preset).toBe("catalog_metadata");
    expect(FULL_REPORT_SECTIONS[0].reportKey).toBe("overview");
  });

  it("last section is artist_development_notes", () => {
    const last = FULL_REPORT_SECTIONS[FULL_REPORT_SECTIONS.length - 1];
    expect(last.preset).toBe("artist_development_notes");
    expect(last.reportKey).toBe("development");
  });

  it("every section maps to a valid preset", () => {
    for (const section of FULL_REPORT_SECTIONS) {
      expect(getPreset(section.preset)).toBeDefined();
    }
  });

  it("full_report preset name is defined", () => {
    expect(FULL_REPORT_PRESET_NAME).toBe("full_report");
  });
});
