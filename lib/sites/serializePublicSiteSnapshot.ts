import type { SiteAsset, SiteDesign, SiteSnapshot } from "./schema";

export type PublicSiteAsset = Pick<SiteAsset, "url" | "name" | "type">;
/** The only fields a published site page receives. Keep this a strict subset of SiteSnapshot. */
export type PublicSiteSnapshot = Pick<SiteSnapshot, "name" | "artistName" | "releaseUrl"> & {
  assets: PublicSiteAsset[];
  design: SiteDesign;
};

const pickAsset = ({ url, name, type }: SiteAsset): PublicSiteAsset => ({ url, name, type });

const pickDesign = (design: SiteDesign): SiteDesign => ({
  headline: design.headline,
  eyebrow: design.eyebrow,
  description: design.description,
  buttonLabel: design.buttonLabel,
  signupHeading: design.signupHeading,
  background: design.background,
  foreground: design.foreground,
  accent: design.accent,
  layout: design.layout,
  font: design.font,
  ...(design.experience
    ? {
        experience: {
          html: design.experience.html,
          css: design.experience.css,
          javascript: design.experience.javascript,
        },
      }
    : {}),
});

/**
 * Build the public payload for a published site by copying an explicit allowlist of fields.
 * Saved brief and request references, evidence documents, gaps, creative direction, reviews,
 * brand-world guidance, asset generation provenance and any future key stay private unless
 * they are named here. Legacy rows may lack optional keys; those are omitted, not emitted.
 */
export function serializePublicSiteSnapshot(published: SiteSnapshot): PublicSiteSnapshot {
  // Derive the display name from release context before that context is left behind.
  const artistName =
    published.production?.context?.release?.artists?.join(", ") || published.artistName;
  const snapshot = {
    name: published.name,
    artistName,
    releaseUrl: published.releaseUrl,
    assets: published.assets?.map(pickAsset),
    design: published.design ? pickDesign(published.design) : undefined,
  };
  return Object.fromEntries(
    Object.entries(snapshot).filter(([, value]) => value !== undefined),
  ) as PublicSiteSnapshot;
}
