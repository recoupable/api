import { z } from "zod";

/**
 * Persisted `artwork_branding` content (module `artwork-branding-v2`).
 * Observation, interpretation and proposal fields stay separate; `scope` is a server-set marker
 * that this document describes one release's artwork, never an enduring artist brand or era.
 */
export const artworkBrandingSchema = z.object({
  scope: z.literal("release"),
  visibleObservations: z.array(z.string()),
  palette: z.array(z.object({ color: z.string(), role: z.string() })),
  typography: z.string(),
  composition: z.string(),
  texturesAndMaterials: z.array(z.string()),
  motifs: z.array(z.string()),
  visualInterpretation: z.string(),
  /** Explicitly labelled proposals. Allowed to be empty; never counted as evidence. */
  proposedDesignChoices: z.array(z.string()),
  uncertainties: z.array(z.string()),
});
export type ArtworkBranding = z.infer<typeof artworkBrandingSchema>;
