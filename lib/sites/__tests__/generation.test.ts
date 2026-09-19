import { beforeEach, expect, it, vi } from "vitest";
import { generateSite } from "../generateSite";
import type { Site } from "../schema";
import { brandWorldSchema } from "../brandWorld/schema";
import { worldFixture } from "./worldFixture";
const ai = vi.hoisted(() => ({ generateObject: vi.fn() }));
vi.mock("ai", () => ai);
const site = {
  name: "Release",
  brief: "Build a fan experience",
  release_url: "",
  draft: null,
  assets: [{ name: "Cover", type: "image", url: "https://assets.example.test/cover.webp" }],
} as unknown as Site;
const design = {
  headline: "Release",
  eyebrow: "",
  description: "Explore",
  buttonLabel: "Play",
  signupHeading: "Updates",
  background: "#101010",
  foreground: "#ffffff",
  accent: "#eeeeee",
  layout: "poster",
  font: "sans",
  experience: { javascript: "const score=0;", html: "<main>Explore</main>", css: "" },
};
beforeEach(() => {
  vi.resetAllMocks();
  ai.generateObject
    .mockResolvedValueOnce({ object: worldFixture })
    .mockResolvedValueOnce({ object: design });
});
it("builds and persists a validated world before generating code", async () => {
  const result = await generateSite(site, "Build it");
  expect(ai.generateObject).toHaveBeenCalledTimes(2);
  const [analysis, implementation] = ai.generateObject.mock.calls.map(call => call[0]);
  expect(analysis.messages[0].content).toContainEqual({
    type: "image",
    image: new URL(site.assets[0].url),
  });
  expect(JSON.stringify(implementation.messages)).toContain(worldFixture.direction.concept);
  expect(result.brandWorld?.specification).toEqual(worldFixture);
  expect(result.brandWorld?.version).toBe(1);
  expect(result.brandWorld?.sourceAssets).toEqual(site.assets);
  expect(result.design.experience?.html).toBe(design.experience.html);
});
it("includes every supplied image and labels their source indices", async () => {
  await generateSite(
    {
      ...site,
      assets: [
        ...site.assets,
        { name: "Reference", type: "image", url: "https://assets.example.test/reference.webp" },
      ],
    },
    "Use the reference",
  );
  const content = ai.generateObject.mock.calls[0][0].messages[0].content;
  expect(content.filter((part: { type: string }) => part.type === "image")).toHaveLength(2);
  expect(content[0].text).toContain('"sourceIndex":1');
});
it("supports a brief-led world without claiming visual evidence when no artwork exists", async () => {
  ai.generateObject
    .mockReset()
    .mockResolvedValueOnce({
      object: { ...worldFixture, observations: [], evidenceMode: "brief-only" },
    })
    .mockResolvedValueOnce({ object: design });
  const result = await generateSite({ ...site, assets: [] }, "Quiet editorial site");
  expect(result.brandWorld?.specification.evidenceMode).toBe("brief-only");
  expect(ai.generateObject.mock.calls[0][0].messages[0].content).toHaveLength(1);
});
it("carries the previous world and current revision request into art direction", async () => {
  const first = await generateSite(site, "Build");
  ai.generateObject
    .mockResolvedValueOnce({ object: worldFixture })
    .mockResolvedValueOnce({ object: design });
  await generateSite({ ...site, draft: first }, "Keep the world; make text bigger");
  const request = JSON.parse(ai.generateObject.mock.calls[2][0].messages[0].content[0].text);
  expect(request.previousWorld.specification).toEqual(worldFixture);
  expect(request.instruction).toBe("Keep the world; make text bigger");
});
it("rejects invented source evidence before spending on code generation", async () => {
  ai.generateObject.mockReset().mockResolvedValueOnce({
    object: {
      ...worldFixture,
      observations: [{ sourceIndex: 7, visible: "Made up", interpretation: "Made up" }],
    },
  });
  await expect(generateSite(site, "Build")).rejects.toThrow();
  expect(ai.generateObject).toHaveBeenCalledTimes(1);
});
it("rejects unsupported asset-production claims", async () => {
  expect(
    brandWorldSchema.safeParse({
      ...worldFixture,
      assets: [{ ...worldFixture.assets[0], production: "image-generator" }],
    }).success,
  ).toBe(false);
});
it("does not proceed when visual analysis fails", async () => {
  ai.generateObject.mockReset().mockRejectedValueOnce(new Error("Vision failed"));
  await expect(generateSite(site, "Build")).rejects.toThrow("Vision failed");
  expect(ai.generateObject).toHaveBeenCalledTimes(1);
});
it("rejects invalid JavaScript without returning a replacement draft", async () => {
  ai.generateObject
    .mockReset()
    .mockResolvedValueOnce({ object: worldFixture })
    .mockResolvedValueOnce({
      object: { ...design, experience: { ...design.experience, javascript: "function {" } },
    });
  await expect(generateSite(site, "Build")).rejects.toThrow();
});
