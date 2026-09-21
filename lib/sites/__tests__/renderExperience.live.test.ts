import { expect, it } from "vitest";
import { renderExperience } from "../production/renderExperience";
import type { SiteSnapshot } from "../schema";
import type { ExperienceContract } from "../production/experienceContract";
const contract = {
  steps: [
    { action: "click", target: "Start", value: "", expected: "Finish", checkpoint: "participate" },
    { action: "click", target: "Finish", value: "", expected: "Your result", checkpoint: "result" },
    { action: "download", target: "Download", value: "", expected: "", checkpoint: "delivery" },
    { action: "share", target: "Share", value: "", expected: "", checkpoint: "delivery" },
  ],
} as ExperienceContract;
const snapshot = {
  assets: [],
  design: {
    experience: {
      html: '<button id="start">Start</button><button id="finish" hidden>Finish</button><section id="result" hidden>Your result<canvas id="art" width="256" height="256"></canvas><button id="download">Download</button><button id="share">Share</button></section>',
      css: "body{margin:0}canvas{display:block}",
      javascript: `document.querySelector('#start').onclick=()=>{document.querySelector('#finish').hidden=false;};document.querySelector('#finish').onclick=()=>{document.querySelector('#result').hidden=false;const c=document.querySelector('canvas').getContext('2d');const g=c.createLinearGradient(0,0,256,256);g.addColorStop(0,'red');g.addColorStop(1,'blue');c.fillStyle=g;c.fillRect(0,0,256,256);c.fillStyle='white';c.font='24px sans-serif';c.fillText('Your result',30,120);};document.querySelector('#download').onclick=()=>{document.querySelector('canvas').toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='result.png';a.click();});};document.querySelector('#share').onclick=()=>{document.querySelector('canvas').toBlob(b=>navigator.share({files:[new File([b],'result.png',{type:'image/png'})]}));};`,
    },
  },
} as unknown as SiteSnapshot;
it.skipIf(process.env.SITES_RENDER_LIVE_TEST !== "1")(
  "completes both viewport journeys and reopens real download/share images",
  async () => {
    const result = await renderExperience(snapshot, contract);
    expect(
      result.report.every(r => r.journeyPassed && !r.errors.length && !r.overflow),
      JSON.stringify(result.report),
    ).toBe(true);
    expect(result.report.every(r => r.artifacts.length === 2)).toBe(true);
    expect(result.images).toHaveLength(6);
  },
  240000,
);
it.skipIf(process.env.SITES_RENDER_LIVE_TEST !== "1")(
  "fails a convincing-looking result with a dead download button",
  async () => {
    const broken = structuredClone(snapshot);
    broken.design.experience!.javascript += "document.querySelector('#download').onclick=()=>{};";
    const result = await renderExperience(broken, contract);
    expect(
      result.report.every(r => !r.journeyPassed && r.errors.some(e => e.includes("Download"))),
    ).toBe(true);
  },
  240000,
);
