import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
const require = createRequire(import.meta.url);
const execute = promisify(execFile);
export async function typecheckFixture(root, source) {
  await writeFile(
    join(source, "packTypes.ts"),
    'export type * from "@/lib/content/packs/packTypes";\n',
  );
  const config = JSON.parse(await readFile(join(source, "tsconfig.json"), "utf8"));
  config.compilerOptions = {
    ...config.compilerOptions,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    jsx: "react-jsx",
  };
  config.include = ["./**/*.ts", join(root, "types/video.d.ts")];
  await writeFile(join(source, "tsconfig.typecheck.json"), JSON.stringify(config));
  // Check strict fixture diagnostics while production dependencies retain their own tsconfig.
  const checker = join(source, "check.cjs");
  const denyUrl = new URL("./denyNetwork.mjs", import.meta.url).href;
  await writeFile(
    checker,
    `
(async () => {
const { denyNetwork } = await import(${JSON.stringify(denyUrl)});
const networkAttempts = denyNetwork();
const ts = require("typescript");
const path = require("node:path");
const config = ts.readConfigFile("tsconfig.typecheck.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = ts.getPreEmitDiagnostics(program).filter(d =>
  !d.file || path.resolve(d.file.fileName).startsWith(process.cwd() + path.sep));
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: f => f, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\\n"
  }));
  process.exitCode = 1;
}
require("node:assert/strict").equal(networkAttempts(), 0);
console.log(JSON.stringify({ networkAttempts: networkAttempts() }));
})().catch(error => { console.error(error); process.exitCode = 1; });
`,
  );
  const check = () => execute(process.execPath, [checker], { cwd: source });
  try {
    const result = await check();
    assert.equal(JSON.parse(result.stdout).networkAttempts, 0);
  } catch (error) {
    throw new Error(error.stderr || error.message);
  }
  const negative = join(source, "payload-drift.ts");
  await writeFile(
    negative,
    'import type { FixtureAsset } from "./fixtureSchemas";\nconst drift: FixtureAsset["files"][number] = { storage_key: "fixture", content_type: "image/png", bytes: "invalid" };\n',
  );
  try {
    await assert.rejects(
      check(),
      error =>
        JSON.parse(error.stdout).networkAttempts === 0 &&
        error.stderr.includes("payload-drift.ts") &&
        error.stderr.includes("TS2322") &&
        error.stderr.includes("Type 'string' is not assignable to type 'number'"),
    );
  } finally {
    await rm(negative);
    await rm(checker);
  }
  console.log("PASS generated fixture TypeScript check and negative payload drift");
  return {
    compiler: require("typescript/package.json").version,
    strict: true,
    scope:
      "All copied/generated fixture modules; production dependency diagnostics use repository checks",
    positive: "passed",
    negativePayloadDrift: "TS2322",
    networkAttempts: 0,
  };
}
