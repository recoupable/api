import { execFileSync } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { readFileSync } from "node:fs";
import pins from "./sources.json";

/** Test transport only: runner-created local socket, never a DSN or hostname. */
export function fixtureSql(sql: string) {
  const socket = process.env.RECOUP_PROOF_BRIDGE_SOCKET;
  if (!socket || !isAbsolute(socket)) throw new Error("Offline fixture socket required");
  const marker = JSON.parse(readFileSync(join(socket, "offline-fixture.json"), "utf8"));
  if (marker.offline_only !== true || marker.database_commit !== pins.database_commit)
    throw new Error("Offline fixture marker mismatch");
  return execFileSync(
    "psql",
    ["-h", socket, "-p", "55483", "-d", "postgres", "-XqAt", "-v", "ON_ERROR_STOP=1"],
    { input: sql, encoding: "utf8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}
