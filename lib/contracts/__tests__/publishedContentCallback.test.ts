import Ajv from "ajv";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/content-agent/callback/route";
import { contentAgentCallbackSchema } from "@/lib/agents/content/validateContentAgentCallback";
import fixture from "../fixtures/published-docs.json";

const mocks = vi.hoisted(() => ({
  configured: true,
  initialize: vi.fn(),
  thread: vi.fn(),
  image: vi.fn(),
  video: vi.fn(),
}));
vi.mock("@/lib/agents/content/bot", () => ({
  get contentAgentBot() {
    return mocks.configured ? { initialize: mocks.initialize } : null;
  },
}));
vi.mock("@/lib/agents/getThread", () => ({ getThread: mocks.thread }));
vi.mock("@/lib/agents/content/downloadMediaBuffer", () => ({ downloadMediaBuffer: mocks.image }));
vi.mock("@/lib/agents/content/downloadVideoBuffer", () => ({ downloadVideoBuffer: mocks.video }));

interface CallbackExample {
  threadId: string;
  status: string;
  results: Array<{ runId: string; status: string; videoUrl?: string; imageUrl?: string }>;
}
interface CallbackContract {
  path: string;
  security: unknown[];
  requestSchema: Record<string, unknown>;
  examples: Record<string, CallbackExample>;
  responseSchemas: Record<string, Record<string, unknown>>;
  responseExamples: Record<string, Record<string, unknown>>;
  responseHeaders: Record<string, Record<string, { schema: { enum: string[] } }>>;
}
const contract = (fixture as unknown as { contentCallback?: CallbackContract }).contentCallback;
let thread: {
  state: Promise<{ status: string }>;
  post: ReturnType<typeof vi.fn>;
  setState: ReturnType<typeof vi.fn>;
};
const request = (body: unknown, secret = "fixture-secret") =>
  new NextRequest("https://example.invalid/api/content-agent/callback", {
    method: "POST",
    headers: { "x-callback-secret": secret },
    body: JSON.stringify(body),
  });

function matchesResponse(response: Response, body: unknown) {
  expect(contract!.responseSchemas).toBeDefined();
  const code = String(response.status);
  const validate = new Ajv({ strict: false, allErrors: true }).compile(
    contract!.responseSchemas[code],
  );
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
  for (const name of [
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Headers",
    "Access-Control-Expose-Headers",
  ]) {
    const header = contract!.responseHeaders[code][name];
    expect(response.headers.get(name)).toBe(header ? header.schema.enum[0] : null);
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured = true;
  vi.stubEnv("CODING_AGENT_CALLBACK_SECRET", "fixture-secret");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected network access in published callback contract");
    }),
  );
  thread = {
    state: Promise.resolve({ status: "running" }),
    post: vi.fn().mockResolvedValue(undefined),
    setState: vi.fn().mockResolvedValue(undefined),
  };
  mocks.thread.mockReturnValue(thread);
  mocks.video.mockResolvedValue(Buffer.from([9]));
  mocks.image.mockResolvedValue({ buffer: Buffer.from([1]), mimeType: "image/jpeg" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("published internal content callback image contract", () => {
  it("declares actual acknowledgements and error envelopes without a stable 500 contract", () => {
    expect(contract).toBeDefined();
    expect(contract!.responseSchemas).toBeDefined();
    expect(Object.keys(contract!.responseSchemas).sort()).toEqual(["200", "400", "401", "503"]);
    expect(contract!.responseExamples["200"]).toEqual({
      processed: { status: "ok" },
      terminalRetry: { status: "ok", skipped: true },
    });
    expect(Object.keys(contract!.responseHeaders["200"])).toHaveLength(4);
    expect(contract!.responseHeaders["503"]).toEqual({});
    const allow = contract!.responseHeaders["200"]["Access-Control-Allow-Headers"].schema.enum[0];
    expect(allow.toLowerCase()).not.toContain("x-callback-secret");
  });

  it("explicitly declares optional string imageUrl without inventing URL validation", () => {
    expect(contract).toBeDefined();
    expect(contract!.path).toBe("/api/content-agent/callback");
    expect(contract!.security).toEqual([{ callbackSecret: [] }]);
    const schema = contract!.requestSchema as {
      properties: {
        results: {
          items: { properties: Record<string, Record<string, unknown>>; required: string[] };
        };
      };
    };
    const row = schema.properties.results.items;
    expect(row.properties.imageUrl).toMatchObject({ type: "string" });
    expect(row.properties.imageUrl.format).toBeUndefined();
    expect(row.required).not.toContain("imageUrl");
    const validate = new Ajv({ strict: false }).compile(contract!.requestSchema);
    const body = structuredClone(contract!.examples.withEditorialImages);
    body.results[0].imageUrl = "not-url-validated";
    expect(validate(body)).toBe(true);
    expect(contentAgentCallbackSchema.safeParse(body).success).toBe(true);
    const invalid = { ...body, results: [{ ...body.results[0], imageUrl: 42 }] };
    expect(validate(invalid)).toBe(false);
    expect(contentAgentCallbackSchema.safeParse(invalid).success).toBe(false);
  });

  it.each(["withEditorialImages", "videoOnly"])(
    "keeps the copied %s example through the actual schema",
    name => {
      expect(contract).toBeDefined();
      const example = contract!.examples[name];
      expect(new Ajv({ strict: false }).compile(contract!.requestSchema)(example)).toBe(true);
      expect(contentAgentCallbackSchema.parse(example)).toEqual(example);
    },
  );

  it("posts copied editorial images in result order before the videos", async () => {
    expect(contract).toBeDefined();
    const body = contract!.examples.withEditorialImages;
    expect(body.results).toHaveLength(2);
    mocks.image.mockImplementation(async (url: string) => ({
      buffer: Buffer.from([url === body.results[0].imageUrl ? 1 : 2]),
      mimeType: "image/jpeg",
    }));
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    const acknowledgement = await response.json();
    expect(acknowledgement).toEqual(contract!.responseExamples["200"].processed);
    matchesResponse(response, acknowledgement);
    expect(mocks.thread).toHaveBeenCalledExactlyOnceWith(body.threadId);
    expect(mocks.image.mock.calls).toEqual(body.results.map(row => [row.imageUrl]));
    expect(thread.post).toHaveBeenCalledTimes(4);
    for (const [index, value] of [1, 2].entries()) {
      expect(thread.post.mock.calls[index][0]).toMatchObject({
        markdown: "**Editorial Image**",
        files: [{ data: Buffer.from([value]), mimeType: "image/jpeg" }],
      });
    }
    expect(thread.post.mock.calls[2][0].files[0].mimeType).toBe("video/mp4");
    expect(thread.post.mock.calls[3][0].files[0].mimeType).toBe("video/mp4");
    expect(thread.setState).toHaveBeenCalledExactlyOnceWith({ status: "completed" });
  });

  it("retains video-only calls without adding image downloads or posts", async () => {
    expect(contract).toBeDefined();
    expect((await POST(request(contract!.examples.videoOnly))).status).toBe(200);
    expect(mocks.image).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledOnce();
    expect(thread.post.mock.calls[0][0].files[0].mimeType).toBe("video/mp4");
  });

  it.each([
    null,
    { buffer: Buffer.from([1]), mimeType: null },
    { buffer: Buffer.from([1]), mimeType: "text/plain" },
  ])(
    "falls back to the image URL before video when media is unavailable or unsupported: %s",
    async image => {
      expect(contract).toBeDefined();
      const body = contract!.examples.withEditorialImages;
      mocks.image.mockResolvedValue(image);
      expect((await POST(request(body))).status).toBe(200);
      expect(thread.post.mock.calls.slice(0, 2).map(call => call[0])).toEqual(
        body.results.map(row => `**Editorial Image:** ${row.imageUrl}`),
      );
      expect(thread.post.mock.calls[2][0].files[0].mimeType).toBe("video/mp4");
      expect(thread.post.mock.calls[3][0].files[0].mimeType).toBe("video/mp4");
    },
  );

  it("rejects invalid image types before accessing the thread or media", async () => {
    expect(contract).toBeDefined();
    const body = contract!.examples.withEditorialImages;
    const response = await POST(
      request({ ...body, results: [{ ...body.results[0], imageUrl: 42 }] }),
    );
    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error).toMatchObject({ status: "error", missing_fields: ["results", 0, "imageUrl"] });
    matchesResponse(response, error);
    expect(mocks.thread).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled();
  });

  it("rejects denied callback secrets before accessing the thread or media", async () => {
    expect(contract).toBeDefined();
    const incoming = new NextRequest("https://example.invalid/api/content-agent/callback", {
      method: "POST",
      headers: { "x-callback-secret": "denied" },
      body: "{",
    });
    const parse = vi.spyOn(incoming, "json");
    const response = await POST(incoming);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual(contract!.responseExamples["401"].denied);
    matchesResponse(response, body);
    expect(parse).not.toHaveBeenCalled();
    expect(mocks.thread).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.video).not.toHaveBeenCalled();
  });

  it("preserves terminal retry skip without another image or video post", async () => {
    expect(contract).toBeDefined();
    thread.state = Promise.resolve({ status: "completed" });
    const response = await POST(request(contract!.examples.withEditorialImages));
    const body = await response.json();
    expect(body).toEqual(contract!.responseExamples["200"].terminalRetry);
    matchesResponse(response, body);
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.video).not.toHaveBeenCalled();
    expect(thread.post).not.toHaveBeenCalled();
  });

  it("does not turn an image-only result into a posted image-only success", async () => {
    expect(contract).toBeDefined();
    const body = structuredClone(contract!.examples.withEditorialImages);
    for (const row of body.results) delete row.videoUrl;
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    const acknowledgement = await response.json();
    expect(acknowledgement).toEqual(contract!.responseExamples["200"].processed);
    matchesResponse(response, acknowledgement);
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.video).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledExactlyOnceWith(
      "Content generation finished but no videos were produced.",
    );
  });

  it("returns the documented JSON parse 400 with shared response headers", async () => {
    expect(contract).toBeDefined();
    const response = await POST(
      new NextRequest("https://example.invalid/api/content-agent/callback", {
        method: "POST",
        headers: { "x-callback-secret": "fixture-secret" },
        body: "{",
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toEqual(contract!.responseExamples["400"].invalidJson);
    matchesResponse(response, body);
    expect(mocks.thread).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled();
  });

  it("returns unconfigured-bot 503 before initialization/auth/parsing, without shared CORS", async () => {
    expect(contract).toBeDefined();
    mocks.configured = false;
    const incoming = new NextRequest("https://example.invalid/api/content-agent/callback", {
      method: "POST",
      headers: { "x-callback-secret": "denied" },
      body: "{",
    });
    const parse = vi.spyOn(incoming, "json");
    const response = await POST(incoming);
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toEqual(contract!.responseExamples["503"].unconfigured);
    matchesResponse(response, body);
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
    expect(mocks.thread).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.video).not.toHaveBeenCalled();
  });

  it.each([
    ["https://example.invalid/files/kept.custom?download=1", "image/jpeg", "kept.custom"],
    ["https://example.invalid/files/image", "image/jpeg", "editorial.jpg"],
    ["https://example.invalid/files/image", "image/png", "editorial.png"],
    ["https://example.invalid/files/image", "image/webp", "editorial.webp"],
    ["https://example.invalid/files/image", "image/gif", "editorial.gif"],
  ])("preserves the documented filename rule for %s and %s", async (url, mimeType, filename) => {
    expect(contract).toBeDefined();
    const body = structuredClone(contract!.examples.withEditorialImages);
    body.results = [{ ...body.results[0], imageUrl: url }];
    mocks.image.mockResolvedValue({ buffer: Buffer.from([1]), mimeType });
    expect((await POST(request(body))).status).toBe(200);
    expect(thread.post.mock.calls[0][0]).toMatchObject({
      markdown: "**Editorial Image**",
      files: [{ filename, mimeType }],
    });
  });
});
