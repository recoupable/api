import { z } from "zod";
import type { Sandbox } from "@vercel/sandbox";

const reportSchema = z
  .array(
    z.object({
      name: z.enum(["mobile", "desktop"]),
      status: z.enum(["captured", "missing-input", "unverified"]),
      reason: z.string().max(1200),
      masked: z
        .array(
          z.object({
            index: z.number().int().min(0).max(199),
            src: z.string().max(4000),
            box: z.object({
              x: z.number().finite(),
              y: z.number().finite(),
              width: z.number().positive().finite(),
              height: z.number().positive().finite(),
            }),
          }),
        )
        .max(8),
    }),
  )
  .max(2);

/** Supplemental failures remain explicit without discarding the completed normal journey. */
export async function collectCoverHiddenEvidence(
  sandbox: Pick<Sandbox, "runCommand" | "readFileToBuffer">,
) {
  let reports: z.infer<typeof reportSchema> = [];
  const images: { viewport: string; image: string }[] = [];
  try {
    const run = await sandbox.runCommand("node", ["cover-review.cjs"]);
    if (run.exitCode !== 0) return { reports, images };
    const bytes = await sandbox.readFileToBuffer({ path: "cover-review-report.json" });
    // Covers 16 URLs x 4000 UTF-16 units even when JSON escapes every unit, plus metadata.
    if (!bytes || bytes.length > 512000) return { reports, images };
    reports = reportSchema.parse(JSON.parse(bytes.toString()));
    if (new Set(reports.map(report => report.name)).size !== reports.length)
      return { reports: [], images };
    for (const name of ["mobile", "desktop"]) {
      const report = reports.find(item => item.name === name);
      if (report?.status !== "captured" || !report.masked.length) continue;
      const image = await sandbox
        .readFileToBuffer({ path: `${name}-cover-hidden.png` })
        .catch(() => null);
      if (image?.length && image.length <= 20000000)
        images.push({ viewport: name, image: `data:image/png;base64,${image.toString("base64")}` });
    }
  } catch {
    console.warn("[sites:cover-review] Supplemental evidence execution or validation failed.");
    return { reports: [], images: [] };
  }
  return { reports, images };
}
