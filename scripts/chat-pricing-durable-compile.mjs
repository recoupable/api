import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { mkdtemp, realpath, readFile, writeFile, symlink, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";
import { createHash } from "node:crypto";
import { denyNetwork } from "./pack-scheduler-workflow-fixture/denyNetwork.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = process.env.CHAT_PRICING_COMPILE_OUTPUT;
const attempts = denyNetwork();
const require = createRequire(join(root, "package.json"));
const builders = createRequire(require.resolve("workflow/next"));
const { StandaloneBuilder } = await import(pathToFileURL(builders.resolve("@workflow/builders")));
const temp = await realpath(await mkdtemp(join(tmpdir(), "chat-pricing-boundary-")));
const source = join(temp, "source");
const previousDirectory = process.cwd();
try {
  await mkdir(source);
  await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");
  for (const name of ["fence", "prepareCatalogSurfaceStep.ts", "sendCatalogSurfaceStep.ts"])
    await symlink(join(root, "app/lib/workflows", name), join(source, name));
  // Actual orchestration, pricing entrypoint and transitive implementations: no pricing seams.
  await writeFile(
    join(source, "workflow.ts"),
    await readFile(join(root, "app/lib/workflows/runAgentWorkflow.ts")),
  );
  await writeFile(
    join(source, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        paths: { "@/*": [join(root, "*")] },
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
  const bundle = await readFile(join(temp, "generated/workflows.cjs"), "utf8");
  const literal = bundle.match(/var workflowCode = (`(?:\\[\s\S]|[^`])*`);/);
  assert(literal, "StandaloneBuilder must expose its actual sandbox source");
  const sandbox = runInNewContext(literal[1], Object.create(null), { timeout: 1000 });
  assert.equal(typeof sandbox, "string");
  assert(
    /WORKFLOW_USE_STEP[^\n]+getTokenCreditUsageStep/.test(sandbox),
    "Missing pricing step reference",
  );
  assert(
    /WORKFLOW_USE_STEP[^\n]+recordCreditDeduction/.test(sandbox),
    "Missing separate debit step reference",
  );
  assert(/await getCreditUsage\(/.test(sandbox), "Real pricing entrypoint must remain wired");
  for (const forbidden of [
    "https://models.dev/api.json",
    "async function fetchModelsDevMetadata",
    "gateway.getAvailableModels()",
  ])
    assert(!sandbox.includes(forbidden), `Pricing network chain escaped its step: ${forbidden}`);
  assert.equal(attempts(), 0);
  const paths = [
    "app/lib/workflows/runAgentWorkflow.ts",
    "lib/credits/handleChatCredits.ts",
    "lib/credits/getCreditUsage.ts",
    "lib/credits/getTokenCreditUsageStep.ts",
    "lib/credits/recordCreditDeduction.ts",
  ];
  const bindings = [];
  for (const path of paths)
    bindings.push({
      path,
      sha256: createHash("sha256")
        .update(await readFile(join(root, path)))
        .digest("hex"),
    });
  if (output)
    await writeFile(
      resolve(previousDirectory, output),
      JSON.stringify(
        {
          runtime: process.version,
          networkAttempts: attempts(),
          bindings,
          sandboxSha256: createHash("sha256").update(sandbox).digest("hex"),
          pricingStep: true,
          separateDebitStep: true,
          pricingNetworkChainAbsent: true,
          scope:
            "Actual sandbox compile inspection only. No workflow, pricing, provider, or debit executed. No blanket absence claim for unrelated SDK code.",
        },
        null,
        2,
      ),
    );
  console.log(
    "PASS actual pricing/debit step boundaries; pricing network chain absent; zero network attempts",
  );
} finally {
  process.chdir(previousDirectory);
  await rm(temp, { recursive: true, force: true });
}
