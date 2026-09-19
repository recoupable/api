import { expect, it } from "vitest";
import { renderExperience } from "../production/renderExperience";
import type { SiteSnapshot } from "../schema";
it.skipIf(process.env.SITES_RENDER_LIVE_TEST !== "1")(
  "renders a disposable experience at two sizes in isolation",
  async () => {
    const result = await renderExperience({
      assets: [],
      design: {
        experience: {
          html: '<button id="play">Play</button>',
          css: "body{margin:0}",
          javascript: 'document.getElementById("play").onclick=()=>document.body.append("Started")',
        },
      },
    } as unknown as SiteSnapshot);
    expect(result.images).toHaveLength(4);
    expect(result.report.every(r => r.changed && !r.errors.length && !r.overflow)).toBe(true);
  },
  240000,
);
