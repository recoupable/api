import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
export async function validateFixtureInputs(source, temp) {
  const { build } = await import("esbuild");
  const outfile = join(temp, "fixture-schemas.cjs");
  await build({
    entryPoints: [join(source, "fixtureSchemas.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
  });
  const { fixtureSchemas } = await import(pathToFileURL(outfile));
  assert.throws(() => fixtureSchemas.command.parse({ action: "claim" }));
  assert.throws(() =>
    fixtureSchemas.command.parse({ action: "settle", error: null, extra: "drift" }),
  );
  assert.throws(() => fixtureSchemas.command.parse({ action: "reserve", credits: 100 }));
  assert.throws(() =>
    fixtureSchemas.file.parse({ storage_key: "fixture", content_type: "image/png", bytes: -1 }),
  );
  assert.throws(() => fixtureSchemas.state.parse({ assets: [], job: {} }));
  assert.deepEqual(fixtureSchemas.command.parse({ action: "settle", error: null }), {
    action: "settle",
    error: null,
  });
}
