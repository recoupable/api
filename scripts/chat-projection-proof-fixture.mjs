import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  mkdtemp,
  realpath,
  mkdir,
  writeFile,
  symlink,
  rm,
  readFile,
  readdir,
} from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.env.CHAT_PROJECTION_RECEIPT;
const require = createRequire(join(root, "package.json"));
const { denyNetwork } = await import(
  pathToFileURL(join(root, "scripts/pack-scheduler-workflow-fixture/denyNetwork.mjs"))
);
const attempts = denyNetwork();
const builders = createRequire(require.resolve("workflow/next"));
const { StandaloneBuilder } = await import(pathToFileURL(builders.resolve("@workflow/builders")));
const temp = await realpath(await mkdtemp(join(tmpdir(), "workflow-origin-probe-")));
const source = join(temp, "source");
const cwd = process.cwd();
let world;
try {
  await mkdir(source);
  await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");
  await writeFile(
    join(source, "workflow.ts"),
    `import {getWritable,getWorkflowMetadata,getStepMetadata} from 'workflow';
import {getWorld} from 'workflow/runtime';
import {getRun} from 'workflow/api';
import {hydrateResourceIO,observabilityRevivers} from 'workflow/observability';
import {writeProjectionObservation} from '@/lib/chat/projection/writeProjectionObservation';
import {verifyProjectionObservation} from '@/lib/chat/projection/verifyProjectionObservation';
import {createProjectionEvidencePorts} from '@/lib/chat/projection/createProjectionEvidencePorts';
import {recordProjectionProofStep} from '@/app/lib/workflows/projection/recordProjectionProofStep';
async function emit(input:any) {
 'use step';
 const runId=getWorkflowMetadata().workflowRunId; const stepId=getStepMetadata().stepId;
 const w=getWritable().getWriter();
 try {
  await w.write({type:'start',messageId:'synthetic-assistant'});
  const proof=await writeProjectionObservation({originRunId:runId,originStepId:stepId,assistantMessageId:'synthetic-assistant',ordinal:0,partIndex:1,original:{type:'custom',kind:'provider.synthetic',providerMetadata:{provider:{opaque:'unchanged'}}}},chunk=>w.write(chunk));
  await w.write({type:'finish'});await w.close();
  return {generatedProjectionObservations:{contract:'recoup-sdk-projection/v1',observations:[proof]}};
 }finally{w.releaseLock();}
}
export async function originProbe(input:any) {
 'use workflow';
 const producer = await emit(input);
 await recordProjectionProofStep(producer.generatedProjectionObservations.observations[0].observation.data.originStepId,producer.generatedProjectionObservations);
 return producer;
}
async function verify(input:any) {
 'use step';
 const world=getWorld();
 const ports=createProjectionEvidencePorts({world});
 return verifyProjectionObservation({...input,ports,signal:new AbortController().signal});
}
export async function readProbe(input:any) {
 'use workflow';
 return verify(input);
}
`,
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
  const { createLocalWorld } = await import(
    pathToFileURL(createRequire(require.resolve("@workflow/core")).resolve("@workflow/world-local"))
  );
  const { setWorld, getWorld } = await import(pathToFileURL(require.resolve("workflow/runtime")));
  const { start, getRun } = await import(pathToFileURL(require.resolve("workflow/api")));
  const { hydrateResourceIO, observabilityRevivers } = await import(
    pathToFileURL(require.resolve("workflow/observability"))
  );
  world = createLocalWorld({ dataDir: join(temp, "journal") });
  setWorld(world);
  world.registerHandler(
    "__wkf_step_",
    (await import(pathToFileURL(join(temp, "generated/steps.cjs")))).POST,
  );
  world.registerHandler(
    "__wkf_workflow_",
    (await import(pathToFileURL(join(temp, "generated/workflows.cjs")))).POST,
  );
  await world.start();
  const { originProbe, readProbe } = await import(
    pathToFileURL(join(temp, "generated/client.mjs"))
  );
  const input = {
    chatId: "synthetic-chat",
    sessionId: "synthetic-session",
    accountId: "synthetic-account",
    messages: [],
    modelId: "synthetic",
    agentContext: {},
  };
  const run = await start(originProbe, [input]);
  let timer;
  const within = async promise => {
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("probe timeout")), 15000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  const result = await within(run.returnValue);
  const observation = result.generatedProjectionObservations.observations[0].observation;
  const record = await getWorld().runs.get(run.runId, { resolveData: "all" });
  const steps = await getWorld().steps.get(run.runId, observation.data.originStepId, {
    resolveData: "all",
  });
  assert.deepEqual(hydrateResourceIO(record, observabilityRevivers).input, [input]);
  const recordedSteps = await getWorld().steps.list({ runId: run.runId, resolveData: "none" });
  const proofStep = recordedSteps.data.find(step =>
    step.stepName.endsWith("//recordProjectionProofStep"),
  );
  assert(proofStep && proofStep.status === "completed");
  const portsOps = [];
  const chunks = [];
  for await (const chunk of getRun(run.runId).getReadable({ ops: portsOps })) chunks.push(chunk);
  await Promise.all(portsOps);
  const { readUIMessageStream } = await import(pathToFileURL(require.resolve("ai")));
  let message;
  for await (const current of readUIMessageStream({
    stream: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
  }))
    message = current;
  assert.deepEqual(JSON.parse(JSON.stringify(message.parts)), [
    observation,
    { type: "text", text: observation.data.fallback.text, state: "done" },
  ]);
  const verified = await start(readProbe, [
    {
      observation,
      message,
      scope: { chatId: input.chatId, sessionId: input.sessionId, accountId: input.accountId },
      producers: [
        {
          deploymentId: record.deploymentId,
          workflowName: record.workflowName,
          stepName: steps.stepName,
          proofStepName: proofStep.stepName,
        },
      ],
    },
  ]);
  assert.deepEqual(await within(verified.returnValue), observation.data.original);
  assert.equal(attempts(), 0);
  const sourcePaths = [
    "package.json",
    "pnpm-lock.yaml",
    "app/lib/workflows/projection/recordProjectionProofStep.ts",
    "scripts/chat-projection-proof-fixture.mjs",
    ...(await readdir(join(root, "lib/chat/projection")))
      .filter(name => name.endsWith(".ts"))
      .map(name => "lib/chat/projection/" + name),
  ];
  const sourcePins = [];
  for (const path of sourcePaths)
    sourcePins.push({
      path,
      sha256: createHash("sha256")
        .update(await readFile(join(root, path)))
        .digest("hex"),
    });
  const receipt = {
    sourcePins,
    node: process.version,
    workflow: "4.2.4",
    networkAttempts: attempts(),
    canonicalReadback: true,
    completedProofReadback: true,
    separateWorkflowAwaitedProofStep: true,
    installedSdkCanonicalAssembly: true,
    verifiedInsideJournaledStep: true,
    scope:
      "Actual production pure proof writer and verifier compiled into synthetic local workflows. Readback required; no write ACK or atomicity claim. No deployment admission, production World/key/provider/DB or activation.",
  };
  if (out) await writeFile(out, JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt));
} finally {
  await world?.close();
  process.chdir(cwd);
  await rm(temp, { recursive: true, force: true });
}
