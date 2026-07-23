import { describe, it, expect } from "vitest";
import { renderWelcomeSteps } from "../renderWelcomeSteps";
import { WELCOME_ONBOARDING_STEPS } from "../welcomeOnboardingSteps";

describe("renderWelcomeSteps", () => {
  it("renders one numbered row per step with its thumbnail", () => {
    const html = renderWelcomeSteps();

    WELCOME_ONBOARDING_STEPS.forEach((step, i) => {
      expect(html).toContain(`${i + 1}. ${step.title}`);
      expect(html).toContain(step.thumbUrl);
    });
  });

  it("uses circular thumbs for PFP steps and square for album covers", () => {
    const html = renderWelcomeSteps();

    // Step 1 (PFP) is circular, step 3 (album cover) is square.
    expect(html).toContain("border-radius:50%");
    expect(html).toContain("border-radius:8px");
  });
});
