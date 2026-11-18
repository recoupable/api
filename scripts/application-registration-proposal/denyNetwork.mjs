import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
import http2 from "node:http2";
import { syncBuiltinESMExports } from "node:module";
const deny = () => {
  throw new Error("Network forbidden in proposed registration qualification");
};
globalThis.fetch = deny;
globalThis.WebSocket = deny;
net.connect = net.createConnection = net.Socket.prototype.connect = deny;
tls.connect = http.request = http.get = https.request = https.get = http2.connect = deny;
syncBuiltinESMExports();
