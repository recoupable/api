import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { prepareSiteRenderArtifacts } from "../production/prepareSiteRenderArtifacts";
import { journeyRunner } from "../production/journeyRunner";
import { getSitePublishIdentity } from "../production/getSitePublishIdentity";
import type { SiteSnapshot } from "../schema";

it("preserves the original renderer document bytes, CSP origins and closing-tag escaping", () => {
  const snapshot = {
    assets: [
      { type: "audio", url: "https://media.example/a.mp3" },
      { type: "video", url: "https://media.example/b.mp4" },
      { type: "image", url: "https://images.example/a.png" },
    ],
    design: { experience: { html: "<p>Fixture</p>", css: "</STYLE>", javascript: '"</SCRIPT>"' } },
  } as SiteSnapshot;
  const expected = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; font-src data:; connect-src 'none'; media-src https://media.example; form-action 'none'; frame-src 'none'; base-uri 'none'"><style><\\/style></style></head><body><p>Fixture</p><script>window.__recoupEvents=[];window.recoup={track:event=>window.__recoupEvents.push(event),join:()=>window.__recoupEvents.push("join")};</script><script>"<\\/script>"</script></body></html>`;
  const result = prepareSiteRenderArtifacts(snapshot);
  expect(result.source).toBe(expected);
  expect(result.journeySource).toBe("null");
  expect(result.runnerSource).toBe(journeyRunner);
  expect(result.evidence.sourceSha256).toBe(createHash("sha256").update(expected).digest("hex"));
});

it("excludes only review history and derived status from publication identity", () => {
  const candidate = {
    name: "Fixture",
    production: {
      version: 1,
      context: { title: "Original" },
      direction: { concept: "Original" },
      reviews: [],
      status: "needs-review",
    },
  } as unknown as SiteSnapshot;
  const input = { siteId: "site", ownerId: "workspace", revision: 2, candidate };
  const before = getSitePublishIdentity(input);
  candidate.production!.status = "reviewed";
  Object.assign(candidate.production!, { reviews: [{ verdict: "pass" }] });
  expect(getSitePublishIdentity(input)).toEqual(before);
  Object.assign(candidate.production!.context, { title: "Changed" });
  expect(getSitePublishIdentity(input).candidateSha256).not.toBe(before.candidateSha256);
});
