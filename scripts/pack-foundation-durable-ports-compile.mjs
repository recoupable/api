import assert from "node:assert/strict";
import { mkdtemp, writeFile, symlink, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const previousDirectory = process.cwd();
const outputPath = process.env.PACK_FOUNDATION_PORTS_COMPILE_OUTPUT
  ? resolve(previousDirectory, process.env.PACK_FOUNDATION_PORTS_COMPILE_OUTPUT)
  : undefined;
const { denyNetwork } = await import(
  pathToFileURL(join(root, "scripts/pack-scheduler-workflow-fixture/denyNetwork.mjs"))
);
const attempts = denyNetwork();
const require = createRequire(join(root, "package.json"));
const builders = createRequire(require.resolve("workflow/next"));
const { StandaloneBuilder } = await import(pathToFileURL(builders.resolve("@workflow/builders")));
const temp = await mkdtemp(join(tmpdir(), "pack-real-ports-compile-"));
const source = `import { runPackFoundationBatch } from "@/lib/content/packs/foundation/runPackFoundationBatch";
import { createPackFoundationServices } from "@/app/workflows/packs/foundation/createPackFoundationServices";
import type { PackActor } from "@/lib/content/packs/packTypes";
import type { PackFoundationSelection } from "@/lib/content/packs/foundation/packFoundationSchema";
export async function actualPortsCompilation(actor:PackActor, jobId:string, bound:number, selection:PackFoundationSelection) {
 "use workflow";
 return runPackFoundationBatch(actor,jobId,bound,selection,createPackFoundationServices(actor,jobId));
}`;
try {
  await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");
  await writeFile(join(temp, "workflow.ts"), source);
  await writeFile(
    join(temp, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        paths: { "@/*": [join(root, "*")] },
      },
    }),
  );
  process.chdir(temp);
  await new StandaloneBuilder({
    buildTarget: "standalone",
    workingDir: temp,
    projectRoot: temp,
    dirs: ["."],
    stepsBundlePath: "./generated/steps.cjs",
    workflowsBundlePath: "./generated/workflows.cjs",
    webhookBundlePath: "./generated/webhook.cjs",
    clientBundlePath: join(temp, "generated/client.mjs"),
  }).build();
  assert.equal(attempts(), 0);
  const bundles = [];
  for (const name of ["steps.cjs", "workflows.cjs", "client.mjs"]) {
    const bytes = await readFile(join(temp, "generated", name));
    bundles.push({
      name,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  if (outputPath)
    await writeFile(
      outputPath,
      JSON.stringify(
        {
          source,
          sourceSha256: createHash("sha256").update(source).digest("hex"),
          networkAttempts: attempts(),
          bundles,
          scope:
            "Compile only: actual composition plus new actual factory and step implementations. No workflow started and no step module executed.",
        },
        null,
        2,
      ),
    );
  console.log(
    "PASS actual factory/composition compile; zero network attempts; no workflow or step execution",
  );
} finally {
  process.chdir(previousDirectory);
  await rm(temp, { recursive: true, force: true });
}
