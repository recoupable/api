/**
 * The four onboarding steps mirrored in the welcome email — a deliberate MIRROR
 * of chat's `ONBOARDING_STEP_IDS` (artists, socials, catalog, task). chat and
 * api share no package, so the list cannot be imported; `__tests__` asserts the
 * titles and order match the app's derived checkpoints, which is what keeps the
 * mirror honest.
 *
 * The baseline valuation is deliberately NOT one of the numbered steps
 * (chat#1889). It is not a derivable checkpoint — `catalogs` persists no
 * valuation and the number is computed live at read time — and numbering the
 * payoff alongside the chores was the wrong model. It stays in the email as the
 * reward the steps unlock.
 *
 * Each step links into the matching `/setup/*` route and is illustrated with art:
 *   - step 1: an overlapping stack of the house cast's PFPs (social proof),
 *   - step 2: a real Instagram post thumbnail with an IG badge,
 *   - steps 3-4: album covers from house artists.
 *
 * The step 1 + step 2 images are pre-composed PNGs on Vercel Blob (overlap and
 * badge overlay can't be done reliably in email HTML), stored durably so they
 * never expire like signed IG/TikTok CDN URLs. Album covers are stable Spotify
 * CDN URLs used directly.
 */
export type WelcomeStep = {
  title: string;
  description: string;
  /** Anchor text appended after the description. */
  linkText: string;
  /** Path appended to the frontend base URL for the step's link + is the CTA target root. */
  linkPath: string;
  imageUrl: string;
  /** "wide" = overlap strip, "square" = album cover, "rounded" = IG post thumb. */
  imageStyle: "wide" | "square" | "rounded";
  imageAlt: string;
};

const BLOB = "https://dxfamqbi5zyezrs5.public.blob.vercel-storage.com/welcome";

export const WELCOME_ONBOARDING_STEPS: WelcomeStep[] = [
  {
    title: "Confirm your artists",
    description: "Add the artists you manage to your roster so Recoup works across all of them.",
    linkText: "Confirm your artists.",
    linkPath: "/setup/artists",
    imageUrl: `${BLOB}/step1-artists-overlap-8yfiYIyB0tye7PnZYmvqU7fAP40JDT.png`,
    imageStyle: "wide",
    imageAlt: "Artists on Recoup",
  },
  {
    title: "Verify their socials",
    description:
      "Check the social profiles matched to each artist so every report pulls the right data.",
    linkText: "Verify artist socials.",
    linkPath: "/setup/socials",
    imageUrl: `${BLOB}/step2-socials-ig-bdKZEyXs5vgFOgAw53ih8NbxSz2lf7.png`,
    imageStyle: "rounded",
    imageAlt: "Instagram post",
  },
  {
    title: "Claim your catalog",
    description: "Connect the songs you own so Recoup can measure and track their value over time.",
    linkText: "Claim your catalog.",
    linkPath: "/setup/catalog",
    imageUrl: "https://i.scdn.co/image/ab67616d00001e028d88dae207e00a332c234837",
    imageStyle: "square",
    imageAlt: "Album cover",
  },
  {
    title: "Automate with tasks",
    description: "Schedule a recurring report and Recoup keeps working your catalog every week.",
    linkText: "Setup your first task.",
    linkPath: "/setup/tasks",
    imageUrl: "https://i.scdn.co/image/ab67616d00001e02793523735641c057708528fe",
    imageStyle: "square",
    imageAlt: "Album cover",
  },
];
