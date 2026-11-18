import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtemp, realpath, mkdir, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { denyNetwork } from "./pack-scheduler-workflow-fixture/denyNetwork.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const previousDirectory = process.cwd();
const output = process.env.CHAT_PRICING_FIXTURE_OUTPUT;
const attempts = denyNetwork();
const require = createRequire(join(root, "package.json"));
const builders = createRequire(require.resolve("workflow/next"));
const { StandaloneBuilder } = await import(pathToFileURL(builders.resolve("@workflow/builders")));
const temp = await realpath(await mkdtemp(join(tmpdir(), "chat-pricing-step-")));
const source = join(temp, "source");
const lookupLog = join(temp, "lookups.txt");
let world;
try {
  await mkdir(source);
  await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");
  const bindings = [];
  for (const name of ["getCreditUsage.ts", "getTokenCreditUsageStep.ts"]) {
    const path = `lib/credits/${name}`;
    const bytes = await readFile(join(root, path));
    await writeFile(join(source, name), bytes);
    bindings.push({ path, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  await writeFile(
    join(source, "model.ts"),
    `import { appendFileSync } from "node:fs";
export async function getModel(id: string) {
 appendFileSync(${JSON.stringify(lookupLog)}, id + "\\n");
 if(id === "failure") throw new Error("synthetic pricing failure");
 if(id === "missing") return undefined;
 return { id, pricing: { input: "0.00003", output: "0.00006" } };
}`,
  );
  await writeFile(
    join(source, "workflow.ts"),
    `import { getCreditUsage } from "./getCreditUsage";
export async function pricingFixture(input: { inputTokens: number; outputTokens: number; modelId: string; gatewayCost?: number }) {
 "use workflow";
 return getCreditUsage({inputTokens:input.inputTokens,outputTokens:input.outputTokens} as never, input.modelId, input.gatewayCost);
}`,
  );
  await writeFile(
    join(source, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        paths: { "@/lib/ai/getModel": [join(source, "model.ts")], "@/*": [join(root, "*")] },
      },
    }),
  );
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
  const { createLocalWorld } = await import(
    pathToFileURL(createRequire(require.resolve("@workflow/core")).resolve("@workflow/world-local"))
  );
  const { setWorld } = await import(pathToFileURL(require.resolve("@workflow/core/runtime")));
  const { start } = await import(pathToFileURL(require.resolve("workflow/api")));
  world = createLocalWorld({ dataDir: join(temp, "journal") });
  setWorld(world);
  const steps = await import(pathToFileURL(join(temp, "generated/steps.cjs")));
  const workflows = await import(pathToFileURL(join(temp, "generated/workflows.cjs")));
  world.registerHandler("__wkf_step_", steps.POST);
  world.registerHandler("__wkf_workflow_", workflows.POST);
  await world.start();
  const { pricingFixture } = await import(pathToFileURL(join(temp, "generated/client.mjs")));
  const cases = [
    { name: "positive", gatewayCost: 0.07, expected: 0.07, lookups: 0 },
    ...[undefined, 0, -1, NaN, Infinity].map((gatewayCost, index) => ({
      name: `fallback-${index}`,
      gatewayCost,
      expected: 0.06,
      lookups: 1,
    })),
    { name: "lookup-failure", modelId: "failure", expected: 0, lookups: 1 },
    { name: "missing-model", modelId: "missing", expected: 0, lookups: 1 },
    { name: "zero-tokens", inputTokens: 0, expected: 0, lookups: 1 },
  ];
  const results = [];
  for (const fixture of cases) {
    await writeFile(lookupLog, "");
    const run = await start(pricingFixture, [
      {
        inputTokens: fixture.inputTokens ?? 1000,
        outputTokens: 500,
        modelId: fixture.modelId ?? "fixture",
        gatewayCost: fixture.gatewayCost,
      },
    ]);
    let timer;
    let value;
    try {
      value = await Promise.race([
        run.returnValue,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Pricing fixture deadline: ${fixture.name}`)),
            15000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    assert(Math.abs(value - fixture.expected) < 1e-12, `Unexpected cost: ${fixture.name}`);
    const lookups = (await readFile(lookupLog, "utf8")).split("\n").filter(Boolean).length;
    assert.equal(lookups, fixture.lookups, `Lookup count: ${fixture.name}`);
    results.push({ name: fixture.name, value, lookups });
  }
  assert.equal(attempts(), 0);
  const result = {
    runtime: process.version,
    networkAttempts: attempts(),
    bindings,
    results,
    scope:
      "Real copied pricing resolver and durable pricing step, synthetic getModel leaf only. No debit/provider/real catalog lookup. Actual full workflow boundary separately compiled without seams.",
  };
  if (output) await writeFile(resolve(previousDirectory, output), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  console.log("PASS nine compiled pricing cases; no debit or network attempts");
} finally {
  await world?.close();
  process.chdir(previousDirectory);
  await rm(temp, { recursive: true, force: true });
}
