import { spawnSync } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { realpathSync, statSync, readFileSync } from "node:fs";
import pins from "./sources.json";
export function fixtureSql(text: string) {
  const socket = process.env.SITES_BRIDGE_SOCKET;
  if (!socket || !isAbsolute(socket) || realpathSync(socket) !== socket)
    throw new Error("Owned canonical fixture socket required");
  const info = statSync(socket);
  if (info.uid !== process.getuid!() || (info.mode & 0o077) !== 0)
    throw new Error("Owned private fixture socket required");
  const marker = JSON.parse(readFileSync(join(socket, "catalog-size.json"), "utf8"));
  if (
    marker.fixture !== "catalog-storage-size" ||
    marker.socket !== socket ||
    marker.databaseTree !== pins.database_tree ||
    marker.uid !== info.uid
  )
    throw new Error("Catalog fixture marker mismatch");
  const r = spawnSync(
    process.env.CATALOG_PSQL!,
    [
      "-h",
      socket,
      "-p",
      "55473",
      "-d",
      "postgres",
      "-XqAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "VERBOSITY=verbose",
    ],
    {
      input: text,
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        PATH: process.env.PATH!,
        HOME: socket,
        LANG: "C",
        PGCLIENTENCODING: "UTF8",
        NODE_ENV: "test",
      },
    },
  );
  if (r.error) throw r.error;
  if (r.status !== 0)
    throw Object.assign(new Error(r.stderr), {
      code: r.stderr.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1],
    });
  return r.stdout.trim();
}
