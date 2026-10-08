import type { IncomingMessage } from "node:http";
import { getOAuthMetadataCacheControl } from "./getOAuthMetadataCacheControl";

/** Bound the actual stream, not just its untrusted Content-Length header. */
export async function readOAuthMetadataResponse(response: IncomingMessage): Promise<Response> {
  try {
    const type = response.headers["content-type"] ?? "";
    const encoding = response.headers["content-encoding"];
    if (
      response.statusCode !== 200 ||
      !/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(type) ||
      (encoding && encoding.toLowerCase() !== "identity") ||
      Number(response.headers["content-length"] ?? 0) > 16384
    ) {
      throw new Error("Invalid OAuth metadata response");
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response) {
      const bytes = Buffer.from(chunk);
      size += bytes.length;
      if (size > 16384) throw new Error("OAuth metadata exceeds size limit");
      chunks.push(bytes);
    }
    const headers = new Headers();
    for (const key of ["cache-control", "age", "date", "expires"]) {
      const value = response.headers[key];
      if (typeof value === "string") headers.set(key, value);
    }
    return new Response(Buffer.concat(chunks).toString("utf8"), {
      headers: {
        "content-type": "application/json",
        "cache-control": getOAuthMetadataCacheControl(headers),
      },
    });
  } finally {
    response.destroy();
  }
}
