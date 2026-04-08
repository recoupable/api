import { describe, expect, it } from "vitest";
import { CONTENT_TEMPLATES } from "@/lib/content/contentTemplates";
import { isSupportedContentTemplate } from "@/lib/content/isSupportedContentTemplate";

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
