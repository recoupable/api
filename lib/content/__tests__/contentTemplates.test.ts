import { describe, expect, it } from "vitest";
import { CONTENT_TEMPLATES, isSupportedContentTemplate } from "@/lib/content/contentTemplates";

describe("contentTemplates", () => {
  it("includes artist-release-editorial template", () => {
    const template = CONTENT_TEMPLATES.find(t => t.name === "artist-release-editorial");
    expect(template).toBeDefined();
    expect(template!.description).toBeTruthy();
    expect(template!.defaultLipsync).toBe(false);
  });

  it("validates artist-release-editorial as supported", () => {
    expect(isSupportedContentTemplate("artist-release-editorial")).toBe(true);
  });
});
