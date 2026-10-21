import Ajv from "ajv";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/content-agent/callback/route";
import { contentAgentCallbackSchema } from "@/lib/agents/content/validateContentAgentCallback";
import fixture from "../fixtures/published-docs.json";

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  thread: vi.fn(),
  image: vi.fn(),
  video: vi.fn(),
}));
vi.mock("@/lib/agents/content/bot", () => ({
  contentAgentBot: { initialize: mocks.initialize },
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

beforeEach(() => {
  vi.resetAllMocks();
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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("published internal content callback image contract", () => {
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
    expect(await response.json()).toEqual({ status: "ok" });
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
    expect(mocks.thread).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled();
  });

  it("rejects denied callback secrets before accessing the thread or media", async () => {
    expect(contract).toBeDefined();
    expect((await POST(request(contract!.examples.withEditorialImages, "denied"))).status).toBe(
      401,
    );
    expect(mocks.thread).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.video).not.toHaveBeenCalled();
  });

  it("preserves terminal retry skip without another image or video post", async () => {
    expect(contract).toBeDefined();
    thread.state = Promise.resolve({ status: "completed" });
    const response = await POST(request(contract!.examples.withEditorialImages));
    expect(await response.json()).toEqual({ status: "ok", skipped: true });
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.video).not.toHaveBeenCalled();
    expect(thread.post).not.toHaveBeenCalled();
  });

  it("does not turn an image-only result into a posted image-only success", async () => {
    expect(contract).toBeDefined();
    const body = structuredClone(contract!.examples.withEditorialImages);
    for (const row of body.results) delete row.videoUrl;
    expect((await POST(request(body))).status).toBe(200);
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.video).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledExactlyOnceWith(
      "Content generation finished but no videos were produced.",
    );
  });
});
