import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, symlink, readdir } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { typecheckFixture } from "../pack-scheduler-workflow-fixture/typecheckFixture.mjs";

const require = createRequire(import.meta.url);
export async function buildFixture(root, here, temp) {
  const source = join(temp, "source");
  await mkdir(source);
  await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");
  const bindings = [];
  const paths = { "@/*": [join(root, "*")] };
  for (const file of await readdir(join(here, "source"))) {
    if (file.endsWith(".ts.txt")) {
      const bytes = await readFile(join(here, "source", file));
      await writeFile(join(source, file.slice(0, -4)), bytes);
      bindings.push({
        path: `scripts/pack-admission-workflow-fixture/source/${file}`,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  paths["@/lib/supabase/release_pack_jobs/runPackCommand"] = [join(source, "runPackCommand.ts")];
  await writeFile(
    join(source, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", paths },
    }),
  );

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
    const { build } = require("esbuild");
    const graph = await build({
      entryPoints: [join(source, "workflow.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      outdir: join(temp, "graph"),
      write: false,
      metafile: true,
      tsconfig: join(source, "tsconfig.json"),
    });
    for (const input of Object.keys(graph.metafile.inputs)) {
      const full = resolve(source, input);
      const path = relative(root, full).replaceAll("\\", "/");
      if (path.startsWith("..") || path.includes("node_modules")) continue;
      if (path.startsWith("lib/supabase/") || path.startsWith("lib/ai/"))
        throw new Error(`Unexpected external effect dependency: ${path}`);
      bindings.push({
        path,
        sha256: createHash("sha256")
          .update(await readFile(full))
          .digest("hex"),
      });
    }
    for (const path of ["pnpm-lock.yaml", "package.json"])
      bindings.push({
        path,
        sha256: createHash("sha256")
          .update(await readFile(join(root, path)))
          .digest("hex"),
      });
    process.chdir(old);
    return { bindings, typecheck };
  } finally {
    process.chdir(old);
  }
}
