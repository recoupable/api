import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSkills } from "@modelcontextprotocol/server/ext/skills/node";
import { isStaffSkill } from "../../lib/mcp/skills/isStaffSkill.mjs";

// Skills stays the source of truth. Pin the published revision so the manifest and
// the files it describes are immutable for the lifetime of a deployment.
const revision = "a5c145c64eb4440be6176420c500732e076ea297";
const root = fileURLToPath(new URL("../../.mcp-skills/", import.meta.url));
const destination = join(root, "generated");
await mkdir(root, { recursive: true });
const staging = await mkdtemp(join(root, ".build-"));
try {
  const response = await fetch(`https://codeload.github.com/recoupable/skills/tar.gz/${revision}`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Recoup Skills archive returned HTTP ${response.status}`);
  const archive = join(staging, "skills.tar.gz");
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  execFileSync("tar", [
    "-xzf",
    archive,
    "-C",
    staging,
    "--strip-components=1",
    `skills-${revision}/skills`,
  ]);
  const catalog = await loadSkills(join(staging, "skills"), {
    strict: true,
    // Hyperframes bundles templates and their assets.
    limits: { files: 1024 },
  });
  const staff = catalog.entries.filter(skill => isStaffSkill(skill.frontmatter.name)).length;
  const customer = catalog.entries.length - staff;
  // Claude Code shows at most 100 skills per connection.
  if (customer > 100 || staff > 100) {
    throw new Error(
      `A Recoup catalog exceeds Claude Code's limit (customer: ${customer}, staff: ${staff})`,
    );
  }
  await rm(destination, { recursive: true, force: true });
  await rename(join(staging, "skills"), destination);
  console.log(`Prepared ${customer} customer and ${staff} staff skills from ${revision}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
