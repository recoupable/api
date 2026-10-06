import type { IncomingMessage, ServerResponse } from "node:http";

type MountedRequest = IncomingMessage & { originalUrl?: string; baseUrl?: string };

/** Node/Next Pages boundary. Mount with bodyParser:false and externalResolver:true. */
export function createOAuthNodeHandler(
  issuer: string,
  callback: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
) {
  const canonical = new URL(issuer);
  if (
    (canonical.protocol !== "https:" &&
      !(canonical.protocol === "http:" && canonical.hostname === "127.0.0.1")) ||
    canonical.username ||
    canonical.password ||
    canonical.search ||
    canonical.hash ||
    canonical.pathname !== "/api/oauth"
  ) {
    throw new Error("Invalid OAuth issuer configuration");
  }
  const mount = canonical.pathname;
  return async (req: MountedRequest, res: ServerResponse) => {
    if (req.headers.host?.toLowerCase() !== canonical.host) {
      res.writeHead(421);
      res.end();
      return;
    }
    const path = req.url?.split("?")[0];
    if (path !== mount && !path?.startsWith(`${mount}/`)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const previous = {
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      host: req.headers["x-forwarded-host"],
      proto: req.headers["x-forwarded-proto"],
    };
    req.originalUrl = req.url;
    req.baseUrl = mount;
    req.url = req.url!.slice(mount.length) || "/";
    if (req.url.startsWith("?")) req.url = `/${req.url}`;
    // Proxy-derived URLs must reflect configured deployment identity, not caller-supplied headers.
    req.headers["x-forwarded-host"] = canonical.host;
    req.headers["x-forwarded-proto"] = canonical.protocol.slice(0, -1);
    res.setHeader("Cache-Control", "no-store");
    try {
      await callback(req, res);
    } finally {
      req.url = previous.url;
      req.originalUrl = previous.originalUrl;
      req.baseUrl = previous.baseUrl;
      if (previous.host === undefined) delete req.headers["x-forwarded-host"];
      else req.headers["x-forwarded-host"] = previous.host;
      if (previous.proto === undefined) delete req.headers["x-forwarded-proto"];
      else req.headers["x-forwarded-proto"] = previous.proto;
    }
  };
}
