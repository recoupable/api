import { WELCOME_EMAIL_CAST } from "@/lib/emails/welcome/welcomeEmailCast";

/**
 * The five onboarding steps mirrored in the welcome email, using the product's
 * real flow language (chat `lib/onboarding/getOnboardingStepContent.ts`:
 * Confirm artists, Verify socials, Claim catalog, Schedule report) plus the
 * baseline valuation. Each step is illustrated with art from the house cast:
 * PFPs for the artist/social steps, album covers for the catalog/value/task
 * steps, so all five artists appear across the email.
 */
export type WelcomeStep = {
  title: string;
  description: string;
  thumbUrl: string;
  /** "circle" for artist PFPs, "square" for album covers. */
  thumbShape: "circle" | "square";
  thumbAlt: string;
};

export const WELCOME_ONBOARDING_STEPS: WelcomeStep[] = [
  {
    title: "Confirm your artists",
    description: "Add the artists you manage to your roster so Recoup works across all of them.",
    thumbUrl: WELCOME_EMAIL_CAST[0].pfpUrl,
    thumbShape: "circle",
    thumbAlt: WELCOME_EMAIL_CAST[0].name,
  },
  {
    title: "Verify their socials",
    description:
      "Check the social profiles matched to each artist so every report pulls the right data.",
    thumbUrl: WELCOME_EMAIL_CAST[3].pfpUrl,
    thumbShape: "circle",
    thumbAlt: WELCOME_EMAIL_CAST[3].name,
  },
  {
    title: "Claim your catalog",
    description: "Connect the songs you own so Recoup can measure and track their value over time.",
    thumbUrl: WELCOME_EMAIL_CAST[2].albumCoverUrl,
    thumbShape: "square",
    thumbAlt: WELCOME_EMAIL_CAST[2].albumName,
  },
  {
    title: "See your baseline valuation",
    description:
      "Get what your catalog is worth today. It is the number every weekly report moves.",
    thumbUrl: WELCOME_EMAIL_CAST[1].albumCoverUrl,
    thumbShape: "square",
    thumbAlt: WELCOME_EMAIL_CAST[1].albumName,
  },
  {
    title: "Automate with tasks",
    description: "Schedule a recurring report and Recoup keeps working your catalog every week.",
    thumbUrl: WELCOME_EMAIL_CAST[4].albumCoverUrl,
    thumbShape: "square",
    thumbAlt: WELCOME_EMAIL_CAST[4].albumName,
  },
];
