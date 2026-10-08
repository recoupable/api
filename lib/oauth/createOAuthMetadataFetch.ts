import { lookup } from "node:dns/promises";
import { request } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { isIP } from "node:net";
import type { Configuration } from "oidc-provider";
import { isPublicOAuthAddress } from "./isPublicOAuthAddress";
import { validateOAuthMetadataUrl } from "./validateOAuthMetadataUrl";
import { readOAuthMetadataResponse } from "./readOAuthMetadataResponse";

/** Credential-free HTTPS with pinned DNS, no redirects, and bounded time/size/concurrency. */
export function createOAuthMetadataFetch(): NonNullable<Configuration["fetch"]> {
  let active = 0;
  return async (input, init) => {
    const url = validateOAuthMetadataUrl(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if ((init?.method && init.method !== "GET") || active >= 8)
      throw new Error("OAuth metadata fetch unavailable");
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const signal = AbortSignal.any([
      AbortSignal.timeout(2500),
      ...(init?.signal ? [init.signal] : []),
    ]);
    signal.throwIfAborted();
    active++;
    try {
      return await new Promise<Response>((resolve, reject) => {
        let req: ClientRequest | undefined;
        let response: IncomingMessage | undefined;
        let settled = false;
        const finish = (error?: Error, result?: Response) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", abort);
          response?.destroy();
          req?.destroy();
          if (error) reject(error);
          else resolve(result!);
        };
        const abort = () => finish(new Error("OAuth metadata fetch aborted"));
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) {
          abort();
          return;
        }
        const addresses = isIP(hostname)
          ? Promise.resolve([{ address: hostname, family: isIP(hostname) }])
          : lookup(hostname, { all: true, verbatim: true });
        void addresses
          .then(records => {
            if (settled) return;
            if (!records.length || records.some(record => !isPublicOAuthAddress(record.address))) {
              throw new Error("OAuth metadata host must resolve only to public addresses");
            }
            const pinned = records[0];
            req = request(
              url,
              {
                method: "GET",
                agent: false,
                headers: { accept: "application/json", "accept-encoding": "identity" },
                // Preserve original hostname for Host/SNI/certificate verification; never resolve twice.
                lookup: (_host, options, callback) => {
                  if (options.all) callback(null, [pinned]);
                  else callback(null, pinned.address, pinned.family);
                },
              },
              incoming => {
                response = incoming;
                if (settled) {
                  incoming.destroy();
                  return;
                }
                void readOAuthMetadataResponse(incoming).then(
                  result => finish(undefined, result),
                  error => finish(error),
                );
              },
            );
            req.on("error", error => finish(error));
            req.end();
          })
          .catch(error => finish(error));
      });
    } finally {
      active--;
    }
  };
}
