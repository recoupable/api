import { spawnSync } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { readFileSync, statSync, realpathSync } from "node:fs";
import pins from "./sources.json";
export function fixtureSql(sql: string) {
  const socket = process.env.SITES_BRIDGE_SOCKET;
  if (!socket || !isAbsolute(socket) || realpathSync(socket) !== socket)
    throw new Error("Owned absolute fixture socket required");
  const info = statSync(socket);
  if (info.uid !== process.getuid!() || (info.mode & 0o077) !== 0)
    throw new Error("Unowned fixture directory");
  const marker = JSON.parse(readFileSync(join(socket, "sites-bridge.json"), "utf8"));
  if (
    marker.offline_only !== true ||
    marker.database_commit !== pins.database_commit ||
    marker.socket !== socket
  )
    throw new Error("Invalid fixture marker");
  const result = spawnSync(
    process.env.SITES_BRIDGE_PSQL!,
    [
      "-h",
      socket,
      "-p",
      "55473",
      "-d",
      "postgres",
      "-U",
      marker.user,
      "-XqAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "VERBOSITY=verbose",
    ],
    {
      input: sql,
      encoding: "utf8",
      timeout: 15000,
      env: {
        PATH: process.env.PATH!,
        HOME: socket,
        LANG: "C",
        LC_ALL: "C",
        PGCLIENTENCODING: "UTF8",
        NODE_ENV: "test",
      },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Object.assign(new Error(result.stderr), {
      proposalError: /CONTEXT:[\s\S]*sites_evidence_proposal\./.test(result.stderr),
      sqlstate: result.stderr.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1],
    });
  return result.stdout.trim();
}
