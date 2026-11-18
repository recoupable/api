import net from "node:net";
import dgram from "node:dgram";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import { fileURLToPath } from "node:url";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
import http2 from "node:http2";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { syncBuiltinESMExports } from "node:module";
const saved = Symbol.for("recoup.disposable.registration.originalSocketConnect");
// Capture once, in Node's --import preload before Vitest or authentication imports.
if (!globalThis[saved]) {
  const explicitPreload = process.execArgv.some(
    (value, index, args) =>
      value === "--import" && args[index + 1] === fileURLToPath(import.meta.url),
  );
  if (!explicitPreload || process.env.REGISTRATION_CONNECTOR_INITIALIZED === String(process.pid))
    throw new Error("Native owned connector preload required");
  globalThis[saved] = Object.freeze({ pid: process.pid, connect: net.Socket.prototype.connect });
  process.env.REGISTRATION_CONNECTOR_INITIALIZED = String(process.pid);
}
if (
  globalThis[saved].pid !== process.pid ||
  process.env.REGISTRATION_CONNECTOR_INITIALIZED !== String(process.pid)
)
  throw new Error("Owned connector initialization mismatch");
const denyNetwork = function () {
  throw new Error("Network forbidden in disposable SQL composition");
};
globalThis.fetch = globalThis.WebSocket = denyNetwork;
dgram.createSocket = dgram.Socket = denyNetwork;
for (const target of [dns, dnsPromises]) {
  for (const key of Object.keys(target)) {
    if (
      key === "Resolver" ||
      key.startsWith("resolve") ||
      key === "reverse" ||
      key === "lookupService"
    )
      target[key] = denyNetwork;
  }
}
// Vite inspects localhost while loading configuration. Answer it without OS/DNS calls.
const syntheticLocalhost = (hostname, options = {}) => {
  if (hostname !== "localhost") return denyNetwork();
  const family = (typeof options === "number" ? options : options.family) === 6 ? 6 : 4;
  const result = { address: family === 6 ? "::1" : "127.0.0.1", family };
  return typeof options === "object" && options.all ? [result] : result;
};
dns.lookup = (hostname, options, callback) => {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const result = syntheticLocalhost(hostname, options);
  if (typeof callback !== "function") throw new Error("Synthetic localhost callback required");
  queueMicrotask(() =>
    Array.isArray(result) ? callback(null, result) : callback(null, result.address, result.family),
  );
};
dnsPromises.lookup = async (hostname, options) => syntheticLocalhost(hostname, options);
net.connect = net.createConnection = net.Socket.prototype.connect = denyNetwork;
tls.connect = http.request = http.get = https.request = https.get = http2.connect = denyNetwork;

/** Allow only the supervisor's current owned Unix socket; never a host/port or alias. */
export function installOwnedSocketGuard() {
  const socket = process.env.REGISTRATION_QUALIFICATION_SOCKET;
  if (!socket || !isAbsolute(socket) || realpathSync(socket) !== socket)
    throw new Error("Owned Unix socket scope required");
  const root = dirname(socket);
  const owner = JSON.parse(readFileSync(join(root, "fixture-owner.json"), "utf8"));
  const scope = JSON.parse(readFileSync(join(root, "composition-scope.json"), "utf8"));
  const expected = join(socket, ".s.PGSQL.55473");
  const identity = lstatSync(expected);
  // Validate the directory last: Node 23.6.1 realpath shares stat scratch state with lstat.
  // Leaving a socket stat last can corrupt cached module-path resolution.
  const directory = lstatSync(socket);
  const pid = readFileSync(join(socket, "pg", "postmaster.pid"), "utf8").split("\n");
  if (
    owner.socket !== socket ||
    owner.cluster !== join(socket, "pg") ||
    scope.socket !== socket ||
    owner.worker_pid !== scope.supervisor_pid ||
    owner.uid !== process.getuid() ||
    directory.uid !== owner.uid ||
    directory.dev !== owner.device ||
    directory.ino !== owner.inode ||
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    !identity.isSocket() ||
    identity.uid !== owner.uid ||
    Number(pid[0]) !== scope.postmaster_pid ||
    pid[1] !== owner.cluster
  )
    throw new Error("Owned Unix socket lease mismatch");
  if (process.ppid === scope.driver_pid)
    process.env.REGISTRATION_COMPOSITION_NODE = String(process.pid);
  else if (process.ppid !== Number(process.env.REGISTRATION_COMPOSITION_NODE))
    throw new Error("Owned qualification parent required");
  console.log(
    "OWNED_NODE_LINEAGE " +
      JSON.stringify({
        version: process.version,
        exec: process.execPath,
        execArgv: process.execArgv,
        pid: process.pid,
        ppid: process.ppid,
        driver_pid: scope.driver_pid,
        supervisor_pid: scope.supervisor_pid,
        node_pid: Number(process.env.REGISTRATION_COMPOSITION_NODE),
        module: import.meta.url,
        original_connect: typeof globalThis[saved].connect,
      }),
  );
  const original = globalThis[saved].connect;
  net.Socket.prototype.connect = function (...args) {
    const current = lstatSync(expected);
    const currentDirectory = lstatSync(socket);
    if (
      !currentDirectory.isDirectory() ||
      currentDirectory.dev !== directory.dev ||
      currentDirectory.ino !== directory.ino ||
      currentDirectory.uid !== directory.uid ||
      args[0] !== expected ||
      args.length > 2 ||
      (args[1] !== undefined && typeof args[1] !== "function") ||
      !current.isSocket() ||
      current.dev !== identity.dev ||
      current.ino !== identity.ino ||
      current.uid !== identity.uid
    )
      throw new Error("Owned Unix socket only; TCP and unrelated paths forbidden");
    return Reflect.apply(original, this, args);
  };
  syncBuiltinESMExports();
}
installOwnedSocketGuard();
