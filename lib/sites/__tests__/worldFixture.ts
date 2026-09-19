export const worldFixture = {
  evidenceMode: "artwork",
  observations: [
    {
      sourceIndex: 0,
      visible: "Layered monochrome paper with a narrow title",
      interpretation: "Quiet physical depth",
    },
  ],
  direction: {
    concept: "A tactile paper listening room",
    preserve: ["Paper depth"],
    avoid: ["Glossy neon"],
    override: "None",
    coverHiddenTest: "Paper layers and restrained type remain without the cover",
  },
  system: {
    palette: [
      { color: "#101010", role: "Readable ink", rationale: "Observed dark lettering" },
      { color: "#ffffff", role: "Paper", rationale: "Observed pale surface" },
    ],
    typography: "Narrow display with readable neutral controls",
    composition: "Layered full scene with one focal point",
    materials: "Subtle torn paper, no generic cards",
    shapes: "Quiet irregular edges",
    depth: "Three overlapping paper planes",
    motion: "Slow paper reveal; static with reduced motion",
    interaction: "Touch reveals layers; keyboard equivalent",
  },
  assets: [
    {
      purpose: "Scene layers",
      production: "procedural",
      sourceIndex: null,
      guidance: "Simple paper contours, no invented figurative art",
      fallback: "Flat tonal planes if texture fails",
    },
  ],
  surfaces: {
    entry: "Title and one action",
    experience: "Explore layers",
    controls: "Compact readable controls",
    connection: "Shared monochrome theme",
    player: "Same shared theme",
    completion: "Quiet replay",
    loadingAndError: "Stable layout with clear status",
  },
  qualityChecks: ["No clipped controls at 360px", "World remains recognizable without cover"],
};
