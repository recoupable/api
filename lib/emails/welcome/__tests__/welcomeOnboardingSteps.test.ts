import { describe, it, expect } from "vitest";
import { WELCOME_ONBOARDING_STEPS } from "../welcomeOnboardingSteps";

/**
 * The email's step list is a deliberate MIRROR of chat's `ONBOARDING_STEP_IDS`
 * (chat and api share no package, so it cannot be imported). This test is what
 * keeps the mirror honest: the app derives 4 checkpoints — artists, socials,
 * catalog, task — and the email must number exactly those, in that order.
 *
 * The baseline valuation is deliberately NOT a numbered step (chat#1889): it
 * isn't a derivable checkpoint (`catalogs` persists no valuation; the number is
 * computed live), and framing the payoff as a chore was the wrong model. It
 * stays in the email as the reward, just not in the count.
 */
const APP_CHECKPOINT_TITLES = [
  "Confirm your artists",
  "Verify their socials",
  "Claim your catalog",
  "Automate with tasks",
];

describe("WELCOME_ONBOARDING_STEPS", () => {
  it("numbers exactly the app's four derived checkpoints, in order", () => {
    expect(WELCOME_ONBOARDING_STEPS.map(s => s.title)).toEqual(APP_CHECKPOINT_TITLES);
  });

  it("does not number the baseline valuation as a step", () => {
    const paths = WELCOME_ONBOARDING_STEPS.map(s => s.linkPath);
    expect(paths).not.toContain("/setup/valuation");
    for (const step of WELCOME_ONBOARDING_STEPS) {
      expect(step.title.toLowerCase()).not.toContain("valuation");
    }
  });

  it("keeps every step pointed at its canonical /setup route", () => {
    expect(WELCOME_ONBOARDING_STEPS.map(s => s.linkPath)).toEqual([
      "/setup/artists",
      "/setup/socials",
      "/setup/catalog",
      "/setup/tasks",
    ]);
  });
});
