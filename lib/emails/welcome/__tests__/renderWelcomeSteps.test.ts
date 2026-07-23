import { describe, it, expect } from "vitest";
import { renderWelcomeSteps } from "../renderWelcomeSteps";
import { WELCOME_ONBOARDING_STEPS } from "../welcomeOnboardingSteps";

const BASE = "https://chat.example.com";

describe("renderWelcomeSteps", () => {
  it("renders one numbered row per step with its image and link", () => {
    const html = renderWelcomeSteps(BASE);

    WELCOME_ONBOARDING_STEPS.forEach((step, i) => {
      expect(html).toContain(`${i + 1}. ${step.title}`);
      expect(html).toContain(step.imageUrl);
      expect(html).toContain(`href="${BASE}${step.linkPath}"`);
      expect(html).toContain(`>${step.linkText}</a>`);
    });
  });

  it("uses a wide strip for step 1 and fixed thumbnails for album covers", () => {
    const html = renderWelcomeSteps(BASE);

    // Step 1 overlap is width-only (height auto); album covers are 56x56.
    expect(html).toContain("width:132px;height:auto");
    expect(html).toContain("width:56px;height:56px");
  });

  it("points every step at its /setup route", () => {
    const html = renderWelcomeSteps(BASE);

    for (const path of [
      "/setup/artists",
      "/setup/socials",
      "/setup/catalog",
      "/setup/valuation",
      "/setup/tasks",
    ]) {
      expect(html).toContain(`href="${BASE}${path}"`);
    }
  });
});
