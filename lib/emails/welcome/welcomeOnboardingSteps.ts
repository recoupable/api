/**
 * The five onboarding steps mirrored in the welcome email, using the product's
 * real flow language (chat `lib/onboarding/getOnboardingStepContent.ts`:
 * Confirm artists, Verify socials, Claim catalog, Schedule report) plus the
 * baseline valuation. Each step links into the matching `/setup/*` route and is
 * illustrated with art:
 *   - step 1: an overlapping stack of the house cast's PFPs (social proof),
 *   - step 2: a real Instagram post thumbnail with an IG badge,
 *   - steps 3-5: album covers from house artists.
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
    title: "See your baseline valuation",
    description:
      "Get what your catalog is worth today. It is the number every weekly report moves.",
    linkText: "See your baseline valuation.",
    linkPath: "/setup/valuation",
    imageUrl: "https://i.scdn.co/image/ab67616d00001e024aafdbad18bc27d7c429cdf1",
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
