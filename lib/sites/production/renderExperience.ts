import { journeyRunner } from "./journeyRunner";
import type { ExperienceContract } from "./experienceContract";
import { Sandbox } from "@vercel/sandbox";
import type { SiteSnapshot } from "../schema";

/** Runs untrusted generated code in a disposable VM with no application credentials. */
export async function renderExperience(snapshot: SiteSnapshot, contract?: ExperienceContract) {
  const sandbox = await Sandbox.create({
    runtime: "node22",
    timeout: 180000,
    ...(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID && process.env.VERCEL_TEAM_ID
      ? {
          token: process.env.VERCEL_TOKEN,
          projectId: process.env.VERCEL_PROJECT_ID,
          teamId: process.env.VERCEL_TEAM_ID,
        }
      : {}),
  });
  try {
    const dependencies = await sandbox.runCommand({
      cmd: "dnf",
      args: [
        "install",
        "-y",
        "fontconfig",
        "dejavu-sans-fonts",
        "nss",
        "nspr",
        "atk",
        "at-spi2-atk",
        "cups-libs",
        "libXcomposite",
        "libXdamage",
        "libXrandr",
        "mesa-libgbm",
        "alsa-lib",
      ],
      sudo: true,
    });
    if (dependencies.exitCode !== 0) throw new Error("Review browser dependencies failed");
    const install = await sandbox.runCommand("npm", [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "playwright-core@1.55.1",
      "@sparticuz/chromium@138.0.2",
    ]);
    if (install.exitCode !== 0) throw new Error("Review browser installation failed");
    // Only known supplied/generated image hosts are available while untrusted code executes.
    const hosts = [
      ...new Set(snapshot.assets.filter(a => a.type === "image").map(a => new URL(a.url).hostname)),
    ];
    await sandbox.updateNetworkPolicy({ allow: hosts });
    const experience = snapshot.design.experience!;
    const source = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; font-src data:; connect-src 'none'; media-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'"><style>${experience.css.replace(/<\/style/gi, "<\\/style")}</style></head><body>${experience.html}<script>${experience.javascript.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
    await sandbox.writeFiles([
      { path: "experience.html", content: Buffer.from(source) },
      { path: "journey.json", content: Buffer.from(JSON.stringify(contract ?? null)) },
      { path: "review.cjs", content: Buffer.from(journeyRunner) },
    ]);
    const run = await sandbox.runCommand("node", ["review.cjs"]);
    if (run.exitCode !== 0)
      throw new Error(`Rendered review did not complete: ${(await run.stderr()).slice(-2500)}`);
    const report = await sandbox.readFileToBuffer({ path: "review.json" });
    if (!report) throw new Error("Rendered review produced no evidence");
    const images: string[] = [];
    for (const name of ["mobile", "mobile-active", "desktop", "desktop-active"]) {
      const bytes = await sandbox.readFileToBuffer({ path: `${name}.png` });
      if (!bytes) throw new Error("Rendered review screenshot missing");
      images.push(`data:image/png;base64,${bytes.toString("base64")}`);
    }
    for (const name of ["mobile", "desktop"]) {
      const resultImage = await sandbox.readFileToBuffer({ path: `${name}-result.png` });
      if (resultImage) images.push(`data:image/png;base64,${resultImage.toString("base64")}`);
    }
    return {
      report: JSON.parse(report.toString()) as {
        name: string;
        errors: string[];
        interacted: boolean;
        changed: boolean;
        journeyPassed: boolean;
        steps: { index: number; checkpoint: string; passed: boolean }[];
        artifacts: { label: string; bytes: number; width: number; height: number }[];
        overflow: boolean;
        text: string;
      }[],
      images,
    };
  } finally {
    await sandbox.stop();
  }
}
