import { describe, expect, it, vi } from "vitest";
import { collectContextArtwork } from "../collectContextArtwork";
import { resolveArtworkBrandingInput } from "../resolveArtworkBrandingInput";
import { validateArtworkBranding } from "../validateArtworkBranding";
import { artworkBrandingSchema } from "../artworkBrandingSchema";
import { compileContextBrief } from "../../compileContextBrief";

function dependencies(content: unknown, options: { reused?: boolean; trace?: unknown } = {}) {
  return {
    authorize: vi.fn(async () => true),
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) =>
      name === "claim_context_enrichment"
        ? { state: options.reused ? "reused" : "claimed", attemptId: "attempt" }
        : args,
    ),
    generate: vi.fn(async () => ({
      content,
      coverage: "partial" as const,
      costUsd: null,
      costStatus: "unknown" as const,
      trace: options.trace ?? { model: "openai/gpt-6-astra" },
    })),
  };
}
const calls = (deps: ReturnType<typeof dependencies>, name: string) =>
  deps.rpc.mock.calls.filter(([called]) => called === name);

// Generic, invented fixtures: no customer artwork or private content.
const typographicPoster = {
  visibleObservations: [
    "Black condensed sans-serif lettering fills the top two-thirds of the square",
    "Plain white background with no photographic element",
    "A thin horizontal rule separates the title block from a small lowercase credit line",
    "Letterforms are tightly kerned and slightly overlap",
  ],
  palette: [
    { color: "#000000", role: "lettering" },
    { color: "#FFFFFF", role: "background" },
  ],
  typography: "Condensed grotesque sans-serif, all caps, heavy weight, very tight tracking",
  composition: "Typographic poster; text as image, centred vertical stack, generous bottom margin",
  texturesAndMaterials: ["Flat uncoated paper look", "Slight ink bleed at letter edges"],
  motifs: ["Horizontal rule", "Stacked title block"],
  visualInterpretation:
    "Reads as a printed gig-poster idiom; restraint comes from scale and spacing rather than imagery",
  proposedDesignChoices: [],
  uncertainties: ["Cannot confirm whether the ink bleed is printed or a digital filter"],
};
const photographicCover = {
  visibleObservations: [
    "Close-up photograph of a face lit by magenta and cyan light from opposite sides",
    "Shallow depth of field; the background dissolves into out-of-focus orange bokeh",
    "Title set small in a white serif at the lower-left corner",
    "Visible film grain across the shadows",
  ],
  palette: [
    { color: "#FF2E88", role: "key light" },
    { color: "#19D3FF", role: "fill light" },
    { color: "#FF8A00", role: "background bokeh" },
  ],
  typography: "Small high-contrast serif, mixed case, lower-left placement",
  composition: "Photographic portrait, off-centre subject, rule of thirds, horizontal light split",
  texturesAndMaterials: ["Film grain", "Skin highlights with specular bloom"],
  motifs: ["Two-tone split lighting", "Circular bokeh"],
  visualInterpretation:
    "Suggests a nocturnal, saturated photographic idiom; the type is subordinate to the image",
  proposedDesignChoices: ["Could pair split lighting with the serif as a recurring layout device"],
  uncertainties: ["Light colours may be gelled lights or post-processing"],
};
const accentOnly = {
  visibleObservations: ["Red accent", "Blue accent"],
  palette: [
    { color: "#FF0000", role: "accent" },
    { color: "#0000FF", role: "accent" },
  ],
  typography: "",
  composition: "",
  texturesAndMaterials: [],
  motifs: [],
  visualInterpretation: "",
  proposedDesignChoices: [],
  uncertainties: [],
};
const releaseInput = (releaseSubjectId: string, artworkUrl: string, assetVersion: string) => ({
  releaseSubjectId,
  artworkUrl,
  assetVersion,
});

describe("artwork branding v2 contract", () => {
  it("persists distinct release-scoped documents for contrasting artwork", async () => {
    const poster = dependencies(typographicPoster);
    const photo = dependencies(photographicCover);
    await collectContextArtwork(
      "a",
      "o",
      "r",
      releaseInput("release-a", "https://example.com/poster.png", "poster-v1"),
      poster,
    );
    await collectContextArtwork(
      "a",
      "o",
      "r",
      releaseInput("release-b", "https://example.com/photo.png", "photo-v1"),
      photo,
    );
    const posterClaim = calls(poster, "claim_context_enrichment")[0][1].p_module as Record<
      string,
      unknown
    >;
    expect(posterClaim).toMatchObject({
      key: "artwork-branding-v2",
      topic: "artwork_branding",
      subjectId: "release-a",
      model: "openai/gpt-6-astra",
      input: { scope: "release", releaseSubjectId: "release-a", assetVersion: "poster-v1" },
    });
    const posterSaved = calls(poster, "complete_context_enrichment")[0][1].p_result as {
      content: Record<string, unknown>;
    };
    const photoSaved = calls(photo, "complete_context_enrichment")[0][1].p_result as {
      content: Record<string, unknown>;
    };
    expect(posterSaved.content).toMatchObject({ scope: "release", ...typographicPoster });
    expect(photoSaved.content).toMatchObject({ scope: "release", ...photographicCover });
    expect(posterSaved.content.typography).not.toEqual(photoSaved.content.typography);
    expect(posterSaved.content.palette).not.toEqual(photoSaved.content.palette);
    expect(() => artworkBrandingSchema.parse(posterSaved.content)).not.toThrow();
  });

  it("rejects accent-colour-only output and records the failed attempt", async () => {
    const deps = dependencies(accentOnly);
    await expect(
      collectContextArtwork(
        "a",
        "o",
        "r",
        releaseInput("release", "https://example.com/cover.png", "v1"),
        deps,
      ),
    ).rejects.toThrow("accent colors");
    expect(calls(deps, "complete_context_enrichment")).toHaveLength(0);
    expect(calls(deps, "fail_context_enrichment")).toHaveLength(1);
  });

  it("rejects output that claims artist intent, endorsement or official brand rules", () => {
    const claims = [
      "The artist intends this lettering to anchor the next era",
      "This palette is the official brand guide for the project",
      "Brand guidelines require this typeface everywhere",
      "The split lighting hints at a game concept for fans",
    ];
    for (const claim of claims)
      expect(() =>
        validateArtworkBranding({
          scope: "release",
          ...typographicPoster,
          visualInterpretation: claim,
        }),
      ).toThrow("artist intent or endorsement");
  });

  it("rejects proposal language inside visible observations", () => {
    expect(() =>
      validateArtworkBranding({
        scope: "release",
        ...typographicPoster,
        visibleObservations: [
          ...typographicPoster.visibleObservations,
          "We propose a dark-mode website built from this lettering",
        ],
      }),
    ).toThrow("proposal");
    expect(() =>
      validateArtworkBranding({
        scope: "release",
        ...typographicPoster,
        visibleObservations: typographicPoster.visibleObservations.slice(0, 2),
      }),
    ).toThrow("three visible observations");
  });

  it("keeps labelled proposals separate from evidence and accepts them", () => {
    const content = validateArtworkBranding({ scope: "release", ...photographicCover });
    expect(content.proposedDesignChoices).toHaveLength(1);
    expect(content.visibleObservations).not.toContain(content.proposedDesignChoices[0]);
  });

  it("fails visibly instead of saving output from a substituted model", async () => {
    const deps = dependencies(typographicPoster, {
      trace: { model: "openai/gpt-6-astra", actualModel: "openai/gpt-5" },
    });
    await expect(
      collectContextArtwork(
        "a",
        "o",
        "r",
        releaseInput("release", "https://example.com/cover.png", "v1"),
        deps,
      ),
    ).rejects.toThrow("Selected artwork model unavailable: openai/gpt-5");
    expect(calls(deps, "complete_context_enrichment")).toHaveLength(0);
    expect(calls(deps, "fail_context_enrichment")).toHaveLength(1);
  });

  it("accepts the selected model when the gateway reports it without a provider prefix", async () => {
    const deps = dependencies(typographicPoster, {
      trace: { model: "openai/gpt-6-astra", actualModel: "gpt-6-astra" },
    });
    await collectContextArtwork(
      "a",
      "o",
      "r",
      releaseInput("release", "https://example.com/cover.png", "v1"),
      deps,
    );
    expect(calls(deps, "complete_context_enrichment")).toHaveLength(1);
  });

  it("yields an explicit gap for missing or unsupported artwork without any provider call", () => {
    const deps = dependencies(typographicPoster);
    const missing = resolveArtworkBrandingInput("release", []);
    expect(missing).toEqual({
      status: "missing",
      gap: {
        topic: "artwork_branding",
        subjectId: "release",
        reason: "no_artwork_in_release_metadata",
        fallback: "release_metadata",
      },
    });
    const insecure = resolveArtworkBrandingInput("release", [
      { url: "http://example.com/cover.png" },
    ]);
    expect(insecure).toMatchObject({
      status: "missing",
      gap: { reason: "unsupported_artwork_url", fallback: "release_metadata" },
    });
    expect(resolveArtworkBrandingInput("release", undefined as never)).toMatchObject({
      status: "missing",
    });
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.rpc).not.toHaveBeenCalled();
  });

  it("selects the largest https image and versions the exact asset", () => {
    const sized = resolveArtworkBrandingInput("release", [
      { url: "https://example.com/64.png", width: 64, height: 64 },
      { url: "https://example.com/640.png", width: 640, height: 640 },
      { url: "https://example.com/300.png", width: 300, height: 300 },
    ]);
    expect(sized).toMatchObject({
      status: "available",
      releaseSubjectId: "release",
      artworkUrl: "https://example.com/640.png",
    });
    const unsized = resolveArtworkBrandingInput("release", [
      { url: "https://example.com/first.png" },
      { url: "https://example.com/second.png" },
    ]);
    expect(unsized).toMatchObject({
      status: "available",
      artworkUrl: "https://example.com/first.png",
    });
    if (sized.status !== "available" || unsized.status !== "available") throw new Error("gap");
    expect(sized.assetVersion).toMatch(/^[a-f0-9]{64}$/);
    expect(sized.assetVersion).not.toEqual(unsized.assetVersion);
    expect(
      resolveArtworkBrandingInput("release", [
        { url: "https://example.com/640.png", width: 640, height: 640 },
      ]),
    ).toMatchObject({ assetVersion: sized.assetVersion });
  });

  it("keeps two releases of one recording separate and never targets the artist subject", async () => {
    const deps = dependencies(typographicPoster);
    const original = resolveArtworkBrandingInput("release-original", [
      { url: "https://example.com/original.png", width: 640, height: 640 },
    ]);
    const reissue = resolveArtworkBrandingInput("release-reissue", [
      { url: "https://example.com/reissue.png", width: 640, height: 640 },
    ]);
    if (original.status !== "available" || reissue.status !== "available") throw new Error("gap");
    await collectContextArtwork("a", "o", "r", original, deps);
    await collectContextArtwork("a", "o", "r", reissue, deps);
    const claims = calls(deps, "claim_context_enrichment").map(
      ([, args]) => args.p_module as { subjectId: string; fingerprint: string; input: unknown },
    );
    expect(claims).toHaveLength(2);
    expect(claims[0].subjectId).toBe("release-original");
    expect(claims[1].subjectId).toBe("release-reissue");
    expect(claims[0].fingerprint).not.toEqual(claims[1].fingerprint);
    expect(claims.map(claim => claim.subjectId)).not.toContain("artist");
    expect(claims[0].input).toMatchObject({ scope: "release" });
  });

  it("lists artwork as missing from a creative-direction brief until extraction exists", () => {
    const brief = compileContextBrief({
      ownerId: "owner",
      requests: [{ id: "request", subjectIds: ["song", "release"] }],
      documents: [
        {
          id: "song:song_summary",
          ownerId: "owner",
          subjectId: "song",
          topic: "song_summary",
          version: 1,
          status: "accepted",
          evidenceKind: "interpretation",
          text: "summary",
          sourceVersionIds: ["song:source"],
          coverage: "partial",
        },
      ],
      purpose: "creative_direction",
      maxCharacters: 4000,
    });
    expect(brief.missingTopics).toContain("artwork_branding");
    expect(brief.readiness).toBe("partial");
  });
});
