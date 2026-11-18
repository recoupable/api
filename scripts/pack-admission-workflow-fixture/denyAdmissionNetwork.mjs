import http2 from "node:http2";
import { syncBuiltinESMExports } from "node:module";
import { denyNetwork } from "../pack-scheduler-workflow-fixture/denyNetwork.mjs";
/** Extend the unchanged shared guard for this fixture's complete declared transport set. */
export function denyAdmissionNetwork() {
  const sharedAttempts = denyNetwork();
  let attempts = 0;
  function deny() {
    attempts++;
    throw new Error("Network forbidden in pack admission fixture");
  }
  globalThis.WebSocket = deny;
  http2.connect = deny;
  syncBuiltinESMExports();
  return () => sharedAttempts() + attempts;
}
