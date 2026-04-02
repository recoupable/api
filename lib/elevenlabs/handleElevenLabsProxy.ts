import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { callElevenLabsMusic } from "./callElevenLabsMusic";
import { handleUpstreamError } from "./handleUpstreamError";
import { buildUpstreamResponse } from "./buildUpstreamResponse";

interface ElevenLabsProxyConfig {
  /** ElevenLabs API path (e.g. "/v1/music") */
  path: string;
  /** Zod-based validator that returns NextResponse on failure or validated data on success */
  validate: (body: unknown) => NextResponse | Record<string, unknown>;
  /** Fallback content-type if ElevenLabs doesn't set one */
  defaultContentType: string;
  /** Prefix for error messages (e.g. "Music generation") */
  errorContext: string;
  /** Extra response headers to include (e.g. Transfer-Encoding: chunked for streaming) */
  extraHeaders?: Record<string, string>;
}

/**
 * Creates a handler that authenticates, validates JSON input, proxies to
 * ElevenLabs, and returns the binary response with forwarded headers.
 * Shared by compose, compose/detailed, and stream endpoints.
 *
 * @param config - The proxy configuration.
 * @returns A Next.js request handler function.
 */
export function createElevenLabsProxyHandler(config: ElevenLabsProxyConfig) {
  return async function (request: NextRequest): Promise<NextResponse | Response> {
    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await safeParseJson(request);
    const validated = config.validate(body);
    if (validated instanceof NextResponse) return validated;

    const { output_format, ...elevenLabsBody } = validated as Record<string, unknown> & {
      output_format?: string;
    };

    try {
      const upstream = await callElevenLabsMusic(config.path, elevenLabsBody, output_format);

      const errorResponse = await handleUpstreamError(upstream, config.errorContext);
      if (errorResponse) return errorResponse;

      const response = buildUpstreamResponse(upstream, config.defaultContentType);

      if (config.extraHeaders) {
        for (const [key, value] of Object.entries(config.extraHeaders)) {
          response.headers.set(key, value);
        }
      }

      return response;
    } catch (error) {
      console.error(`ElevenLabs ${config.path} error:`, error);
      return NextResponse.json(
        { status: "error", error: `${config.errorContext} failed` },
        { status: 500, headers: getCorsHeaders() },
      );
    }
  };
}
