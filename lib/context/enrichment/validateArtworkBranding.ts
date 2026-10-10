import type { ArtworkBranding } from "./artworkBrandingSchema";

const ENDORSEMENT_PATTERNS = [
  /\bartist'?s? (intends?|intended|endorses?|endorsed|approves?|approved|wants?|wanted)\b/i,
  /\bofficial brand (guide|rule|book|identity|guidelines?)\b/i,
  /\bbrand guidelines?\b/i,
  /\bgame concept\b/i,
];
const PROPOSAL_PATTERN = /\b(should|recommend(?:s|ed)?|we propose|proposal)\b/i;
const strings = (value: ArtworkBranding) => [
  ...value.visibleObservations,
  ...value.palette.flatMap(entry => [entry.color, entry.role]),
  value.typography,
  value.composition,
  ...value.texturesAndMaterials,
  ...value.motifs,
  value.visualInterpretation,
  ...value.proposedDesignChoices,
  ...value.uncertainties,
];

/**
 * Deterministic evidence checks for parsed artwork content. Throws before any save so the
 * runner records a visible failed attempt instead of persisting weak or invented evidence.
 */
export function validateArtworkBranding(content: ArtworkBranding): ArtworkBranding {
  const nonPaletteEvidence = [
    content.typography.trim(),
    content.composition.trim(),
    ...content.texturesAndMaterials.map(item => item.trim()),
    ...content.motifs.map(item => item.trim()),
  ].filter(Boolean);
  if (!nonPaletteEvidence.length)
    throw new Error("Artwork evidence is limited to accent colors; no visual document was saved");
  if (content.visibleObservations.filter(item => item.trim()).length < 3)
    throw new Error("Artwork evidence needs at least three visible observations");
  const endorsement = strings(content).find(text =>
    ENDORSEMENT_PATTERNS.some(pattern => pattern.test(text)),
  );
  if (endorsement !== undefined)
    throw new Error("Artwork evidence claims artist intent or endorsement");
  if (content.visibleObservations.some(text => PROPOSAL_PATTERN.test(text)))
    throw new Error("Artwork evidence mixes a proposal into visible observations");
  return content;
}
