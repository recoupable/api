import type { ArtworkBranding } from "./artworkBrandingSchema";

const AUTHORITY_PATTERNS = [
  /\bartist'?s? (intends?|intended|endorses?|endorsed|approves?|approved|wants?|wanted)\b/i,
  /\bofficial brand (guide|rule|book|identity|guidelines?)\b/i,
  /\bbrand guidelines?\b/i,
  /\bgame concept\b/i,
];
const PROPOSAL_PATTERN = /\b(should|recommend(?:s|ed)?|we propose|proposal)\b/i;
/** A hedge or negation earlier in the same sentence ("No brand guidelines are visible"). */
const NEGATION = /\b(no|not|never|nothing|none|without|cannot|can't|unclear|unknown|whether)\b/i;
/** Lettering quoted from the image is evidence, not a claim ("Title reads 'YOU SHOULD KNOW'"). */
const QUOTED = /(^|[\s([:])(['‘"“])[^'‘’"“”]*['’"”](?=$|[\s.,;:!?)\]])/g;
const PLACEHOLDER = /^(n\/?a|none|null|unknown|not applicable|not visible|-+|—)$/i;

const unquoted = (text: string) => text.replace(QUOTED, "$1");
const sentences = (text: string) => unquoted(text).split(/[.;!?]+/);
const assertsAuthority = (text: string) =>
  sentences(text).some(sentence =>
    AUTHORITY_PATTERNS.some(pattern => {
      const match = pattern.exec(sentence);
      return match !== null && !NEGATION.test(sentence.slice(0, match.index));
    }),
  );
const present = (text: string) => text.trim() !== "" && !PLACEHOLDER.test(text.trim());
/** Assertive fields only: `uncertainties` exists to hold hedges such as "cannot tell whether…". */
const assertiveStrings = (value: ArtworkBranding) => [
  ...value.visibleObservations,
  ...value.palette.flatMap(entry => [entry.color, entry.role]),
  value.typography,
  value.composition,
  ...value.texturesAndMaterials,
  ...value.motifs,
  value.visualInterpretation,
  ...value.proposedDesignChoices,
];

/**
 * Deterministic evidence-shape checks for parsed artwork content. Throws inside the enrichment
 * call, before `complete_context_enrichment`, so nothing is saved. The runner then marks the
 * attempt `unknown` through `fail_context_enrichment`; see ARTWORK.md for what that means.
 */
export function validateArtworkBranding(content: ArtworkBranding): ArtworkBranding {
  const nonPaletteEvidence = [
    content.typography,
    content.composition,
    ...content.texturesAndMaterials,
    ...content.motifs,
  ].filter(present);
  if (!nonPaletteEvidence.length)
    throw new Error("Artwork evidence is limited to accent colors; no visual document was saved");
  if (content.visibleObservations.filter(present).length < 3)
    throw new Error("Artwork evidence needs at least three visible observations");
  if (assertiveStrings(content).some(assertsAuthority))
    throw new Error("Artwork evidence claims artist intent or endorsement");
  if (content.visibleObservations.some(text => PROPOSAL_PATTERN.test(unquoted(text))))
    throw new Error("Artwork evidence mixes a proposal into visible observations");
  return content;
}
