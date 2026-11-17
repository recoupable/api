import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
export function denyNetwork() {
  let networkAttempts = 0;
  const deny = () => {
    networkAttempts++;
    throw new Error("Network forbidden in pack scheduler fixture");
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
  return () => networkAttempts;
}
