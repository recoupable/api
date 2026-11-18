import type { createProposedRegistrationMcpLifetime } from "./createProposedRegistrationMcpLifetime";

// Parse complete entries: quoted parameter text must never establish a media range.
function mediaRanges(value: string | null) {
  const token = "[!#$%&'*+.^_`|~0-9A-Za-z-]+";
  const quoted = '"(?:[^"\\\\\\r\\n]|\\\\[^\\r\\n])*"';
  const parameter = `\\s*;\\s*(${token})\\s*=\\s*(${token}|${quoted})`;
  const entry = new RegExp(`\\s*(${token}/${token})((?:${parameter})*)\\s*(,|$)`, "gy");
  const ranges: { type: string; quality: number; canonical: string }[] = [];
  if (!value) return ranges;
  let offset = 0;
  while (offset < value.length) {
    const match = entry.exec(value);
    if (!match || (match[5] === "," && entry.lastIndex === value.length)) return [];
    let quality = 1;
    let hasQuality = false;
    for (const param of match[2].matchAll(new RegExp(parameter, "g"))) {
      if (param[1].toLowerCase() !== "q") continue;
      if (hasQuality || !/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(param[2])) return [];
      quality = Number(param[2]);
      hasQuality = true;
    }
    const type = match[1].toLowerCase();
    ranges.push({ type, quality, canonical: type + match[2] });
    offset = entry.lastIndex;
  }
  return ranges;
}
/** Read once, count wire bytes, and reject non-single or unacknowledged tool execution. */
export async function readProposedRegistrationMcpBody(
  request: Request,
  life: ReturnType<typeof createProposedRegistrationMcpLifetime>,
): Promise<unknown> {
  const fail = (status: number, message: string, code = -32600): never => {
    throw Response.json({ jsonrpc: "2.0", error: { code, message }, id: null }, { status });
  };
  const accept = mediaRanges(request.headers.get("accept"));
  const accepts = (type: string) => {
    const explicit = accept.filter(range => range.type === type);
    return explicit.length > 0 && explicit.every(range => range.quality > 0);
  };
  if (!accepts("application/json") || !accepts("text/event-stream"))
    fail(406, "Both JSON and event-stream must be accepted", -32000);
  const contentType = mediaRanges(request.headers.get("content-type"));
  if (contentType.length !== 1 || contentType[0].type !== "application/json")
    fail(415, "JSON content type required", -32000);
  // SDK 1.26 also checks case-sensitive substrings. Canonicalize only validated
  // media tokens on this same request; credentials, parameters and body stay intact.
  request.headers.set("accept", accept.map(range => range.canonical).join(", "));
  request.headers.set("content-type", contentType[0].canonical);
  if (Number(request.headers.get("content-length")) > 65536) fail(413, "Request body too large");
  if (!request.body) fail(400, "Invalid JSON", -32700);
  // No asynchronous gap between checking the owner and registering the acquired reader.
  life.assertActive();
  const reader = request.body!.getReader();
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      reader.releaseLock();
    }
  };
  life.own(async () => {
    if (!released) {
      try {
        await reader.cancel();
      } finally {
        release();
      }
    }
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(Response.json({ error: "Request body timeout" }, { status: 408 })),
      5000,
    );
  });
  try {
    const bytes: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await life.run(() => Promise.race([reader.read(), timeout]));
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 65536) fail(413, "Request body too large");
      bytes.push(chunk.value);
    }
    release();
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of bytes) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(joined));
    } catch {
      fail(400, "Invalid JSON", -32700);
    }
    if (Array.isArray(body)) fail(400, "Batches are unsupported");
    if (
      body &&
      typeof body === "object" &&
      "method" in body &&
      body.method === "tools/call" &&
      !("id" in body && (typeof body.id === "string" || typeof body.id === "number"))
    )
      fail(400, "Tool calls require an id");
    return body;
  } finally {
    clearTimeout(timer);
  }
}
