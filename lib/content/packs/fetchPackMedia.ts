import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isPackPublicAddress } from "./isPackPublicAddress";
/** Fetch untrusted media with DNS pinning, redirect revalidation, time and byte limits. */
export async function fetchPackMedia(
  raw: string,
  redirects = 0,
): Promise<{ bytes: Buffer; contentType: string }> {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    redirects > 3
  )
    throw new Error("Unsupported media URL");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(item => !isPackPublicAddress(item.address)))
    throw new Error("Media host must resolve only to public addresses");
  const target = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        lookup: (_host, options, callback) => {
          if (options.all)
            (
              callback as unknown as (
                error: null,
                addresses: { address: string; family: number }[],
              ) => void
            )(null, [target]);
          else callback(null, target.address, target.family);
        },
        timeout: 30_000,
      },
      response => {
        if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
          response.resume();
          if (!response.headers.location) return reject(new Error("Invalid media redirect"));
          void fetchPackMedia(new URL(response.headers.location, url).href, redirects + 1).then(
            resolve,
            reject,
          );
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error("Media download failed"));
          return;
        }
        if (Number(response.headers["content-length"]) > 50 * 1024 * 1024) {
          response.destroy();
          reject(new Error("Media exceeds 50 MiB"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", chunk => {
          size += chunk.length;
          if (size > 50 * 1024 * 1024) {
            response.destroy(new Error("Media exceeds 50 MiB"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            bytes: Buffer.concat(chunks),
            contentType: String(response.headers["content-type"] ?? "application/octet-stream"),
          }),
        );
      },
    );
    const deadline = setTimeout(() => req.destroy(new Error("Media download timed out")), 30_000);
    req.on("close", () => clearTimeout(deadline));
    req.on("timeout", () => req.destroy(new Error("Media download timed out")));
    req.on("error", reject);
    req.end();
  });
}
