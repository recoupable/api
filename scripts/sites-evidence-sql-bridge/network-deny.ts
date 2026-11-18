import { createRequire, syncBuiltinESMExports } from "node:module";
const require = createRequire(import.meta.url);
export const networkAttempts: string[] = [];
function denied(name: string) {
  return () => {
    networkAttempts.push(name);
    throw new Error(`Network forbidden in offline fixture: ${name}`);
  };
}
if (process.env.SITES_BRIDGE_SOCKET) {
  for (const [module, names] of Object.entries({
    "node:net": ["connect", "createConnection"],
    "node:tls": ["connect"],
    "node:http": ["request", "get"],
    "node:https": ["request", "get"],
    "node:http2": ["connect"],
    "node:dns": ["lookup", "resolve", "resolve4", "resolve6"],
    "node:dgram": ["createSocket"],
  })) {
    const target = require(module);
    for (const name of names) target[name] = denied(`${module}.${name}`);
  }
  require("node:net").Socket.prototype.connect = denied("Socket.connect");
  for (const name of ["lookup", "resolve", "resolve4", "resolve6"])
    require("node:dns").promises[name] = denied(`dns.promises.${name}`);
  globalThis.fetch = denied("fetch");
  globalThis.WebSocket = class {
    constructor() {
      denied("WebSocket")();
    }
  } as unknown as typeof WebSocket;
  syncBuiltinESMExports();
}
