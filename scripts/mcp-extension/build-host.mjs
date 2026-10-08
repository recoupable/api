import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
await build({
  entryPoints: ["ui/recoup/dev/host.ts"],
  bundle: true,
  outfile: "ui/recoup/host.js",
  format: "iife",
  target: "es2022",
});
await writeFile(
  "ui/recoup/host.html",
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Recoup local host test</title></head><body style="margin:0"><script src="host.js"></script></body></html>',
);
