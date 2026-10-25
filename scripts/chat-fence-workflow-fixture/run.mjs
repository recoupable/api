/** Actual production orchestration, copied byte-for-byte; synthetic effect seams only. */
import assert from "node:assert/strict";
import { createRequire, syncBuiltinESMExports } from "node:module";
import {
  mkdtemp,
  realpath,
  mkdir,
  readFile,
  writeFile,
  symlink,
  rm,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let networkAttempts = 0;
const deny = () => {
  networkAttempts++;
  throw new Error("Network forbidden in production workflow fixture");
};
globalThis.fetch = deny;
net.connect = deny;
net.createConnection = deny;
net.Socket.prototype.connect = deny;
tls.connect = deny;
http.request = deny;
http.get = deny;
https.request = deny;
https.get = deny;
syncBuiltinESMExports();
process.env.WORKFLOW_TELEMETRY_DISABLED = "1";
process.env.DO_NOT_TRACK = "1";
const temp = await realpath(await mkdtemp(join(tmpdir(), "chat-production-fence-")));
const source = join(temp, "source");
await mkdir(source);
await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");
const bindings = [];
async function copy(from, to) {
  const bytes = await readFile(join(root, from));
  await writeFile(join(source, to), bytes);
  bindings.push({ path: from, sha256: createHash("sha256").update(bytes).digest("hex") });
}
await copy("app/lib/workflows/runAgentWorkflow.ts", "workflow.ts");
await mkdir(join(source, "fence"));
for (const name of await readdir(join(root, "app/lib/workflows/fence")))
  if (name.endsWith(".ts")) await copy(`app/lib/workflows/fence/${name}`, `fence/${name}`);
await copy("lib/chat/auto-commit/autoCommitChatTurn.ts", "autoCommitChatTurn.ts");
for (const path of [
  "lib/chat/fence/encodeStrictJson.ts",
  "lib/chat/fence/persistence/createFencedMessageWriter.ts",
  "lib/supabase/chat_fence/executeChatFenceCommand.ts",
  "lib/chat/upsertAssistantDataPart.ts",
  "lib/chat/auto-commit/buildCommitData.ts",
]) {
  bindings.push({
    path,
    sha256: createHash("sha256")
      .update(await readFile(join(root, path)))
      .digest("hex"),
  });
}
const paths = {
  "@/*": [join(root, "*")],
  "@/app/lib/workflows/fence/*": [join(source, "fence/*")],
  "@/lib/chat/auto-commit/autoCommitChatTurn": [join(source, "autoCommitChatTurn.ts")],
  "@/lib/supabase/serverClient": [join(source, "rpc.ts")],
};
await writeFile(
  join(source, "events.ts"),
  `import {appendFileSync,readFileSync} from "node:fs";
import {join} from "node:path";
export function record(action: string, data: unknown = null) {appendFileSync(join(process.env.WORKFLOW_FENCE_EFFECTS!,"events.jsonl"),JSON.stringify({action,data})+"\\n");}
export function scenario() {return JSON.parse(readFileSync(join(process.env.WORKFLOW_FENCE_EFFECTS!,"scenario.json"),"utf8"));}
`,
);
await writeFile(
  join(source, "rpc.ts"),
  `import {record,scenario} from "./events";
export default {async rpc(_name: string, args: any) {
record("rpc",args); const s=scenario();
if(args.p_action==="bind" && s.fail==="bind") return {data:null,error:{code:"40001"}};
if(args.p_action==="write" && (args.p.role===s.fail || (["iteration","catalog-fail"].includes(s.fail) && args.p.role==="assistant"))) return {data:null,error:{code:"40001"}};
if(args.p_action==="write" && s.fail==="ambiguous" && args.p.role==="assistant") throw new Error("synthetic lost acknowledgement");
if(args.p_action==="update_parts" && s.fail==="parts") return {data:{updated:false},error:null};
if(args.p_action==="release" && s.fail==="release") return {data:{released:false},error:null};
return {error:null,data:args.p_action==="bind"?{bound:true}:args.p_action==="release"?{released:true}:args.p_action==="update_parts"?{updated:true}:{written:true,outcome:"inserted"}};
}};
`,
);
const seams = [
  [
    "@/app/lib/workflows/generateAssistantMessageId",
    "generateAssistantMessageId",
    'record("id"); return "fresh-assistant";',
  ],
  [
    "@/app/lib/workflows/convertMessagesStep",
    "convertMessagesStep",
    'record("convert"); return [];',
  ],
  ["@/app/lib/workflows/sendStreamStart", "sendStreamStart", 'record("stream-start",args[1]);'],
  ["@/app/lib/workflows/sendStreamFinish", "sendStreamFinish", 'record("stream-finish");'],
  ["@/app/lib/workflows/closeChatStream", "closeChatStream", 'record("stream-close");'],
  [
    "@/app/lib/workflows/routeChatModelStep",
    "routeChatModelStep",
    'record("routing"); return {modelId:"synthetic",metadata:{selectedModelId:"auto",trace:"retained"}};',
  ],
  [
    "@/app/lib/workflows/runAgentStep",
    "runAgentStep",
    'record("provider",{original:args[0].originalMessages}); const {readUIMessageStream}=await import("ai"); const initial=args[0].originalMessages[0]; const stream=new ReadableStream({start(c){c.enqueue({type:"start",messageId:initial.id});c.enqueue({type:"text-start",id:"generated"});c.enqueue({type:"text-delta",id:"generated",delta:"synthetic result"});c.enqueue({type:"text-end",id:"generated"});c.enqueue({type:"finish"});c.close();}}); let responseMessage; for await(const value of readUIMessageStream({message:initial,stream})) responseMessage=value; record("sdk-optional",Object.hasOwn(responseMessage.parts.at(-1),"providerMetadata")); return {finishReason:scenario().fail==="iteration"?"tool-calls":"stop",aborted:false,responseMessages:[],responseMessage};',
  ],
  [
    "@/app/lib/workflows/persistAssistantMessageStep",
    "persistAssistantMessageStep",
    'record("legacy-write");',
  ],
  ["@/lib/chat/clearChatActiveStream", "clearChatActiveStream", 'record("legacy-clear");'],
  ["@/app/lib/workflows/deleteEphemeralKeyStep", "deleteEphemeralKeyStep", 'record("key-delete");'],
  ["@/lib/credits/handleChatCredits", "handleChatCredits", 'record("credits");'],
  [
    "@/lib/chat/auto-commit/hasAutoCommitChanges",
    "hasAutoCommitChanges",
    'record("sandbox-check"); return true;',
  ],
  [
    "@/lib/chat/auto-commit/runAutoCommit",
    "runAutoCommit",
    'record("commit"); return {committed:true,pushed:true,commitSha:"synthetic-sha",commitMessage:"synthetic"};',
  ],
  ["@/lib/chat/auto-commit/sendCommitChunk", "sendCommitChunk", 'record("commit-chunk",args[2]);'],
  ["@/lib/chat/persistAssistantDataPart", "persistAssistantDataPart", 'record("legacy-parts");'],
  [
    "@/app/lib/workflows/prepareCatalogSurfaceStep",
    "prepareCatalogSurfaceStep",
    'record("catalog-prepare"); return {};',
  ],
  [
    "@/app/lib/workflows/sendCatalogSurfaceStep",
    "sendCatalogSurfaceStep",
    'record("catalog-send"); return {id:args[1],role:"assistant",parts:[],metadata:{trace:"retained"}};',
  ],
];
for (const [path, name, body] of seams) {
  const file = `${name}.ts`;
  paths[path] = [join(source, file)];
  await writeFile(
    join(source, file),
    `import {record,scenario} from "./events";\nexport async function ${name}(...args: any[]) {\n  "use step";\n  ${body}\n}\n`,
  );
}
await writeFile(
  join(source, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", paths },
  }),
);
const builders = createRequire(require.resolve("workflow/next"));
const { StandaloneBuilder } = await import(pathToFileURL(builders.resolve("@workflow/builders")));
const old = process.cwd();
let world;
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
  const { createLocalWorld } = await import(
    pathToFileURL(createRequire(require.resolve("@workflow/core")).resolve("@workflow/world-local"))
  );
  const { setWorld, reenqueueRun } = await import("@workflow/core/runtime");
  const { start } = await import("workflow/api");
  const effects = join(temp, "effects");
  await mkdir(effects);
  process.env.WORKFLOW_FENCE_EFFECTS = effects;
  world = createLocalWorld({ dataDir: join(temp, "journal") });
  setWorld(world);
  const steps = await import(pathToFileURL(join(temp, "generated/steps.cjs")));
  const workflows = await import(pathToFileURL(join(temp, "generated/workflows.cjs")));
  world.registerHandler("__wkf_step_", steps.POST);
  let deliveries = 0;
  world.registerHandler("__wkf_workflow_", async req => {
    const result = await workflows.POST(req);
    deliveries++;
    return result;
  });
  await world.start();
  const { runAgentWorkflow } = await import(pathToFileURL(join(temp, "generated/client.mjs")));
  const authority = {
    chatId: "chat",
    effectiveAccount: "11111111-1111-4111-8111-111111111111",
    epoch: 1,
    owner: "22222222-2222-4222-8222-222222222222",
  };
  const user = {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text: "hello" }],
    metadata: { trace: "original" },
  };
  const input = {
    chatId: "chat",
    sessionId: "session",
    accountId: authority.effectiveAccount,
    modelId: "auto",
    messages: [user],
    repoOwner: "synthetic",
    repoName: "synthetic",
    agentContext: {
      sandbox: { state: { sandboxId: "synthetic" }, workingDirectory: "/synthetic" },
      ephemeralKeyId: "synthetic-key-never-revoked",
    },
  };
  const events = async () =>
    (await readFile(join(effects, "events.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(x => JSON.parse(x));
  async function bounded(p) {
    let timer;
    try {
      return await Promise.race([
        p,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("compiled fixture deadline")), 20000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  const traces = [];
  for (const name of [
    "success",
    "bind",
    "user",
    "assistant",
    "ambiguous",
    "iteration",
    "catalog-fail",
    "parts",
    "release",
    "catalog",
    "new-object",
    "resume",
    "legacy",
  ]) {
    await writeFile(join(effects, "events.jsonl"), "");
    await writeFile(join(effects, "scenario.json"), JSON.stringify({ fail: name }));
    const invocation = {
      kind: "internal-fenced/v1",
      input: structuredClone(input),
      fence: {
        authority,
        attemptId: "77777777-7777-4777-8777-777777777777",
        turn: { kind: "new" },
      },
    };
    if (name === "catalog" || name === "catalog-fail") invocation.input.devCatalogSurface = {};
    if (name === "iteration") invocation.input.modelId = "synthetic";
    if (name === "new-object" || name === "resume")
      invocation.input.messages.push({
        id: "historical-assistant",
        role: "assistant",
        parts: [{ type: "text", text: "OLD" }],
        metadata: { trace: "old" },
      });
    if (name === "resume")
      invocation.fence.turn = { kind: "same-turn-resume", assistantId: "historical-assistant" };
    const run = await start(runAgentWorkflow, [name === "legacy" ? invocation.input : invocation]);
    if (
      [
        "bind",
        "user",
        "assistant",
        "ambiguous",
        "iteration",
        "catalog-fail",
        "parts",
        "release",
      ].includes(name)
    )
      await assert.rejects(bounded(run.returnValue), /reconciliation/);
    else await bounded(run.returnValue);
    const trace = await events();
    const actions = trace.map(x => x.action);
    const commands = trace.filter(x => x.action === "rpc").map(x => x.data);
    if (name !== "legacy") {
      assert.equal(actions[0], "rpc");
      assert.equal(commands[0].p_action, "bind");
      assert(!actions.includes("legacy-clear"));
      assert(!actions.includes("key-delete"));
      assert(!actions.includes("legacy-write"));
      assert(!actions.includes("legacy-parts"));
      for (const c of commands) {
        assert.equal(c.p.run_id, run.runId);
        assert.equal(c.p.epoch, 1);
        assert.equal(c.p.owner, authority.owner);
      }
      if (name === "bind") assert.deepEqual(actions, ["rpc"]);
      if (name === "user") {
        assert(!actions.includes("routing"));
        assert(!actions.includes("provider"));
      }
      if (name === "assistant" || name === "ambiguous") assert(!actions.includes("provider"));
      if (["user", "assistant", "ambiguous", "iteration", "catalog-fail", "parts"].includes(name)) {
        assert(!commands.some(c => c.p_action === "release"));
        assert(!actions.includes("stream-finish"));
      }
      if (name === "iteration") assert.equal(actions.filter(x => x === "provider").length, 1);
      if (name === "parts") assert.equal(actions.filter(x => x === "commit").length, 1);
      if (name === "release") assert(!actions.includes("stream-finish"));
      if (name === "success") {
        assert.equal(trace.find(x => x.action === "sdk-optional").data, true);
        assert.deepEqual(
          commands.map(c => c.p_action),
          ["bind", "write", "write", "write", "update_parts", "release"],
        );
        assert(commands[4].p.parts.parts.some(p => p.type === "data-commit"));
        assert.equal(commands[4].p.parts.metadata.trace, "retained");
        assert(
          trace.findIndex(x => x.action === "rpc" && x.data.p_action === "release") <
            actions.indexOf("stream-finish"),
        );
        // Completed journal replay must not repeat any provider/write/commit/cleanup effect.
        const beforeReplay = deliveries;
        await reenqueueRun(world, run.runId);
        await bounded(
          (async () => {
            while (deliveries === beforeReplay) await new Promise(r => setTimeout(r, 20));
          })(),
        );
        assert.deepEqual(await events(), trace);
      }
      if (name === "new-object") {
        const original = trace.find(x => x.action === "provider").data.original[0];
        assert.equal(original.id, "fresh-assistant");
        assert.deepEqual(original.parts, []);
      }
      if (name === "resume") {
        const original = trace.find(x => x.action === "provider").data.original[0];
        assert.equal(original.id, "historical-assistant");
        assert.equal(original.parts[0].text, "OLD");
      }
    } else {
      assert.equal(commands.length, 0);
      assert(actions.includes("legacy-clear"));
      assert(actions.includes("key-delete"));
      assert(actions.includes("legacy-parts"));
    }
    traces.push({ name, runId: run.runId, trace });
    console.log(`PASS actual compiled workflow: ${name}`);
  }
  assert.equal(networkAttempts, 0);
  const { build } = await import("esbuild");
  await build({
    stdin: {
      contents: `export {buildChatExecutionSnapshot} from "${join(root, "lib/chat/fence/buildChatExecutionSnapshot.ts")}"; export {canonicalizeChatAdmission} from "${join(root, "lib/chat/fence/canonicalizeChatAdmission.ts")}"; export {policy} from "${join(root, "lib/chat/fence/__tests__/snapshotFixture.ts")}";`,
      resolveDir: root,
      loader: "ts",
    },
    outfile: join(temp, "canonical.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    tsconfig: join(root, "tsconfig.json"),
  });
  const { buildChatExecutionSnapshot, canonicalizeChatAdmission, policy } = require(
    join(temp, "canonical.cjs"),
  );
  const execution = buildChatExecutionSnapshot({
    id: "compiled-workflow-snapshot",
    requestId: authority.owner,
    workflowInput: input,
    credentialPolicy: policy,
  });
  const admission = canonicalizeChatAdmission({
    contractVersion: "chat-admission/v1",
    effectiveAccountId: authority.effectiveAccount,
    chatId: input.chatId,
    sessionId: input.sessionId,
    expectedEpoch: 0,
    messages: input.messages,
    options: { modelId: input.modelId },
    executionSnapshot: { id: execution.snapshot.id, digest: execution.digest },
  });
  const admissionPayload = {
    request_id: authority.owner,
    expected_epoch: 0,
    input_hash: admission.inputHash,
    admission_envelope: admission.envelope,
    execution_snapshot: execution.snapshot,
    admission_canonical: admission.canonical,
    execution_canonical: execution.canonical,
  };
  const result = {
    result: "PASS",
    sourceBindings: bindings,
    admissionPayload,
    networkAttempts,
    traces,
    limits:
      "Actual production orchestration and required steps, synthetic provider/key/stream/RPC seams; SQL qualification replays captured commands separately. No live authorization or credential recovery proof.",
  };
  if (process.env.WORKFLOW_FENCE_OUTPUT)
    await writeFile(process.env.WORKFLOW_FENCE_OUTPUT, JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        result: result.result,
        cases: traces.length,
        sourceBindings: bindings,
        networkAttempts,
        limits: result.limits,
      },
      null,
      2,
    ),
  );
} finally {
  await world?.close();
  process.chdir(old);
  await rm(temp, { recursive: true, force: true });
}
