import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

it("rejects contradictory scrape states with strict null checks", () => {
  const filename = path.resolve(__dirname, "profileScrapeResult.type-fixture.ts");
  const source = `
    import type { ProfileScrapeResult } from "../profileScrapeResult";

    const started: ProfileScrapeResult = {
      state: "started", runId: "run", datasetId: null, error: null,
    };
    const failed: ProfileScrapeResult = {
      state: "failed", runId: null, datasetId: null, error: "Unavailable",
    };
    // @ts-expect-error A started attempt cannot carry a failure.
    const startedError: ProfileScrapeResult = { state: "started", runId: "run", datasetId: null, error: "Unavailable" };
    // @ts-expect-error A started attempt must have a run ID.
    const missingRun: ProfileScrapeResult = { state: "started", runId: null, datasetId: null, error: null };
    // @ts-expect-error A failed attempt cannot carry a run ID.
    const failedRun: ProfileScrapeResult = { state: "failed", runId: "run", datasetId: null, error: "Unavailable" };
    // @ts-expect-error A failed attempt must describe the failure.
    const missingError: ProfileScrapeResult = { state: "failed", runId: null, datasetId: null, error: null };

    const results: ProfileScrapeResult[] = [started, failed];
    const runIds: string[] = results.filter(result => result.state === "started").map(result => result.runId);
  `;
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) =>
    file === filename
      ? ts.createSourceFile(file, source, languageVersion)
      : getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([filename], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => ({
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  }));

  expect(diagnostics).toEqual([]);
});
