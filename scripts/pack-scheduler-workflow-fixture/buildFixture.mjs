import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, symlink, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { typecheckFixture } from "./typecheckFixture.mjs";
import { validateFixtureInputs } from "./validateFixtureInputs.mjs";
const require = createRequire(import.meta.url);
export async function buildFixture(root, here, temp) {
  const source = join(temp, "source");
  await mkdir(source);
  await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");
  const bindings = [];
  const paths = { "@/*": [join(root, "*")] };
  async function copy(from, to) {
    const bytes = await readFile(join(root, from));
    await writeFile(join(source, to), bytes);
    bindings.push({ path: from, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  await copy("lib/content/packs/runBoundedPackProduction.ts", "runBoundedPackProduction.ts");
  for (const name of ["preparePackStep", "producePackAssetStep", "settleBoundedPackStep"])
    await copy(`app/workflows/packs/${name}.ts`, `${name}.ts`);
  for (const from of [
    "lib/content/packs/producePackAsset.ts",
    "lib/content/packs/buildPackAssetPrompt.ts",
    "lib/content/packs/resolvePackCreativeContext.ts",
    "pnpm-lock.yaml",
  ]) {
    bindings.push({
      path: from,
      sha256: createHash("sha256")
        .update(await readFile(join(root, from)))
        .digest("hex"),
    });
  }
  for (const file of await readdir(join(here, "source"))) {
    if (file.endsWith(".ts.txt")) {
      const bytes = await readFile(join(here, "source", file));
      await writeFile(join(source, file.slice(0, -4)), bytes);
      bindings.push({
        path: `scripts/pack-scheduler-workflow-fixture/source/${file}`,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  for (const name of [
    "@/lib/supabase/release_pack_jobs/runPackCommand",
    "@/lib/content/packs/preparePackProduction",
    "@/lib/content/packs/createPackProductionServices",
  ])
    paths[name] = [join(source, `${name.split("/").at(-1)}.ts`)];
  await writeFile(
    join(source, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", paths },
    }),
  );
  await validateFixtureInputs(source, temp);
  const typecheck = await typecheckFixture(root, source);
  const builders = createRequire(require.resolve("workflow/next"));
  const { StandaloneBuilder } = await import(pathToFileURL(builders.resolve("@workflow/builders")));
  const old = process.cwd();
  try {
    process.chdir(source);
    await new StandaloneBuilder({
      buildTarget: "standalone",
      workingDir: source,
      projectRoot: source,
      dirs: ["."],
      stepsBundlePath: "../generated/steps.cjs",
      workflowsBundlePath: "../generated/workflows.cjs",
      webhookBundlePath: "../generated/webhook.cjs",
      clientBundlePath: join(temp, "generated/client.mjs"),
    }).build();
    process.chdir(old);
    return { bindings, typecheck };
  } finally {
    process.chdir(old);
  }
}
