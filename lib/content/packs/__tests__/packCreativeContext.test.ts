import { describe, expect, it } from "vitest";
import { releasePackBriefSchema } from "../releasePackSchema";
import { getPackBriefReadiness } from "../getPackBriefReadiness";
import { resolvePackCreativeContext } from "../resolvePackCreativeContext";
import { getPackBriefFingerprint } from "../getPackBriefFingerprint";
import { buildPackAssetPrompt } from "../buildPackAssetPrompt";

const base = {
  artist_name: "New Artist",
  song_title: "First Song",
  audio_url: "https://media.example/song.wav",
  occasion: "rediscovery",
  creative_direction: "Old campaign red glossy look",
};
const creative = {
  starting_point: "rough_idea",
  working_mode: "guided",
  references: [
    {
      id: "portrait",
      title: "Approved artist portrait",
      url: "https://media.example/artist.png",
      media_type: "image",
      source_kind: "customer",
      usage: "production",
    },
    {
      id: "inspiration",
      title: "Visual inspiration only",
      url: "https://media.example/inspiration.png",
      media_type: "image",
      source_kind: "public",
      usage: "reference_only",
    },
  ],
  directions: [
    {
      id: "paper",
      name: "Paper at midnight",
      concept: "Quiet torn paper collage with no invented face",
      palette: ["ink", "cream"],
      typography: "Large editorial serif",
      reference_ids: ["portrait", "inspiration"],
      board_url: "https://media.example/board.png",
    },
  ],
};
const selected = (selected_by = "customer") => ({
  ...creative,
  selection: {
    direction_id: "paper",
    selected_by,
    decision_note:
      selected_by === "customer"
        ? "Customer chose the paper direction"
        : "Customer delegated the creative choice",
  },
});

describe("pack creative context", () => {
  it("saves a proposed guided board but blocks final production readiness", () => {
    const brief = releasePackBriefSchema.parse({ ...base, creative_context: creative });
    expect(getPackBriefReadiness(brief).missing).toEqual(["creative_direction_selection"]);
    expect(getPackBriefReadiness(brief).next_action).toContain("direction");
  });
  it("does not treat an agent's selection as guided customer approval", () => {
    const brief = releasePackBriefSchema.parse({ ...base, creative_context: selected("agent") });
    expect(getPackBriefReadiness(brief).ready).toBe(false);
  });
  it("uses the selected world in real prompts and only explicit production-image inputs", () => {
    const brief = resolvePackCreativeContext(
      releasePackBriefSchema.parse({ ...base, creative_context: selected() }),
    );
    expect(getPackBriefReadiness(brief).ready).toBe(true);
    expect(brief.reference_image_urls).toEqual(["https://media.example/artist.png"]);
    const prompt = buildPackAssetPrompt(brief, "artwork", 0);
    expect(prompt).toContain("Paper at midnight");
    expect(prompt).toContain("ink");
    expect(prompt).toContain("Large editorial serif");
    expect(prompt).not.toContain("Old campaign red");
    expect(prompt).not.toContain("https://media.example/inspiration.png");
  });
  it("lets a delegated autonomous selection proceed without a customer direction checkpoint", () => {
    const brief = releasePackBriefSchema.parse({
      ...base,
      creative_context: { ...selected("agent"), working_mode: "autonomous" },
    });
    expect(getPackBriefReadiness(brief).ready).toBe(true);
  });
  it("asks the autonomous agent to select a direction instead of sending the customer another interview", () => {
    const brief = releasePackBriefSchema.parse({
      ...base,
      creative_context: { ...creative, working_mode: "autonomous" },
    });
    const result = getPackBriefReadiness(brief);
    expect(result.ready).toBe(false);
    expect(result.next_action).toContain("Choose");
    expect(result.next_action).not.toContain("Ask once");
  });
  it("rejects duplicate or dangling direction/reference identifiers", () => {
    for (const context of [
      { ...selected(), references: [...creative.references, creative.references[0]] },
      { ...selected(), directions: [...creative.directions, creative.directions[0]] },
      { ...selected(), selection: { ...selected().selection, direction_id: "missing" } },
      { ...selected(), directions: [{ ...creative.directions[0], reference_ids: ["missing"] }] },
    ])
      expect(releasePackBriefSchema.safeParse({ ...base, creative_context: context }).success).toBe(
        false,
      );
  });
  it("does not permit non-image production sources or more than five combined images", () => {
    expect(
      releasePackBriefSchema.safeParse({
        ...base,
        creative_context: {
          ...selected(),
          references: [
            { ...creative.references[0], media_type: "document" },
            creative.references[1],
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      releasePackBriefSchema.safeParse({
        ...base,
        reference_image_urls: Array.from({ length: 5 }, (_, i) => `https://media.example/${i}.png`),
        creative_context: selected(),
      }).success,
    ).toBe(false);
  });
  it("binds mode and selection to the fingerprint while preserving legacy normalization", () => {
    const original = releasePackBriefSchema.parse(base);
    expect(original).not.toHaveProperty("creative_context");
    expect(resolvePackCreativeContext(original)).toEqual(original);
    expect(getPackBriefFingerprint({ ...base, creative_context: selected() })).not.toBe(
      getPackBriefFingerprint({
        ...base,
        creative_context: { ...selected(), working_mode: "autonomous" },
      }),
    );
    expect(getPackBriefFingerprint({ ...base, creative_context: creative })).not.toBe(
      getPackBriefFingerprint({ ...base, creative_context: selected() }),
    );
  });
  it("keeps the maximum selected direction valid as a normalized production brief", () => {
    const context = selected();
    const brief = releasePackBriefSchema.parse({
      ...base,
      creative_context: {
        ...context,
        directions: [
          {
            ...context.directions[0],
            name: "n".repeat(120),
            concept: "c".repeat(1200),
            palette: Array(8).fill("p".repeat(48)),
            typography: "t".repeat(200),
          },
        ],
      },
    });
    const resolved = resolvePackCreativeContext(brief);
    expect(resolved.creative_direction!.length).toBeLessThanOrEqual(2000);
    expect(releasePackBriefSchema.safeParse(resolved).success).toBe(true);
  });
});
