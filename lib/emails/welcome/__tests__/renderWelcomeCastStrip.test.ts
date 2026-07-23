import { describe, it, expect } from "vitest";
import { renderWelcomeCastStrip } from "../renderWelcomeCastStrip";
import { WELCOME_EMAIL_CAST } from "../welcomeEmailCast";

describe("renderWelcomeCastStrip", () => {
  it("renders every cast artist's name and PFP", () => {
    const html = renderWelcomeCastStrip();

    for (const artist of WELCOME_EMAIL_CAST) {
      expect(html).toContain(artist.name);
      expect(html).toContain(artist.pfpUrl);
    }
  });

  it("renders circular avatars", () => {
    expect(renderWelcomeCastStrip()).toContain("border-radius:50%");
  });
});
