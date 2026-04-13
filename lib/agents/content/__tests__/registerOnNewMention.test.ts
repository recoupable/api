import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerOnNewMention } from "../handlers/registerOnNewMention";

vi.mock("@/lib/trigger/triggerCreateContent", () => ({
  triggerCreateContent: vi.fn(),
}));

vi.mock("@/lib/trigger/triggerPollContentRun", () => ({
  triggerPollContentRun: vi.fn(),
}));

vi.mock("@/lib/content/resolveArtistSlug", () => ({
  resolveArtistSlug: vi.fn(),
}));

vi.mock("@/lib/content/getArtistContentReadiness", () => ({
  getArtistContentReadiness: vi.fn(),
}));

vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: vi.fn(),
}));

vi.mock("@/lib/content/contentTemplates", () => ({
  DEFAULT_CONTENT_TEMPLATE: "artist-caption-bedroom",
}));

vi.mock("../parseContentPrompt", () => ({
  parseContentPrompt: vi.fn(),
}));

vi.mock("../extractMessageAttachments", () => ({
  extractMessageAttachments: vi.fn(),
}));

vi.mock("@/lib/agents/buildTaskCard", () => ({
  buildTaskCard: vi.fn((_title: string, _message: string, _runId: string) => ({
    mockCard: true,
  })),
}));

const { buildTaskCard } = await import("@/lib/agents/buildTaskCard");
const { triggerCreateContent } = await import("@/lib/trigger/triggerCreateContent");
const { triggerPollContentRun } = await import("@/lib/trigger/triggerPollContentRun");
const { resolveArtistSlug } = await import("@/lib/content/resolveArtistSlug");
const { getArtistContentReadiness } = await import("@/lib/content/getArtistContentReadiness");
const { parseContentPrompt } = await import("../parseContentPrompt");
const { extractMessageAttachments } = await import("../extractMessageAttachments");

/**
 * Creates a mock content agent bot for testing.
 *
 * @returns A mock bot with onNewMention and getHandler methods.
 */
function createMockBot() {
  let handler: ((thread: unknown, message: unknown) => Promise<void>) | null = null;
  return {
    onNewMention: vi.fn((fn: typeof handler) => {
      handler = fn;
    }),
    getHandler: () => handler,
  };
}

/**
 * Creates a mock thread for testing.
 *
 * @returns A mock thread with post and setState methods.
 */
function createMockThread() {
  return {
    id: "thread-123",
    post: vi.fn(),
    setState: vi.fn(),
  };
}

/**
 * Creates a mock message for testing.
 *
 * @param text - The message text.
 * @returns A mock message object.
 */
function createMockMessage(text: string) {
  return { text };
}

describe("registerOnNewMention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractMessageAttachments).mockResolvedValue({
      songUrl: null,
      imageUrls: [],
    });
  });

  it("registers a handler on the bot", () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);
    expect(bot.onNewMention).toHaveBeenCalledOnce();
  });

  it("calls parseContentPrompt with the message text", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: true,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make me a lipsync video");
    await bot.getHandler()!(thread, message);

    expect(parseContentPrompt).toHaveBeenCalledWith("make me a lipsync video");
  });

  it("passes parsed lipsync flag to triggerCreateContent", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: true,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make me a lipsync video");
    await bot.getHandler()!(thread, message);

    expect(triggerCreateContent).toHaveBeenCalledWith(expect.objectContaining({ lipsync: true }));
  });

  it("passes parsed batch count and triggers that many times", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: false,
      batch: 3,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make me 3 videos");
    await bot.getHandler()!(thread, message);

    expect(triggerCreateContent).toHaveBeenCalledTimes(3);
  });

  it("passes parsed captionLength and upscale to triggerCreateContent", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: false,
      batch: 1,
      captionLength: "long",
      upscale: true,
      template: "artist-caption-stage",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("high quality stage video with long caption");
    await bot.getHandler()!(thread, message);

    expect(triggerCreateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        captionLength: "long",
        upscale: true,
        template: "artist-caption-stage",
      }),
    );
  });

  it("passes parsed songs to triggerCreateContent", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: true,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
      songs: ["hiccups"],
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make a lipsync video for the hiccups song");
    await bot.getHandler()!(thread, message);

    expect(triggerCreateContent).toHaveBeenCalledWith(
      expect.objectContaining({ songs: ["hiccups"] }),
    );
  });

  it("omits songs from triggerCreateContent when not specified", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make me a video");
    await bot.getHandler()!(thread, message);

    const payload = vi.mocked(triggerCreateContent).mock.calls[0][0];
    expect(payload).not.toHaveProperty("songs");
  });

  it("includes lipsync and batch info in acknowledgment message", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: true,
      batch: 2,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make 2 lipsync videos");
    await bot.getHandler()!(thread, message);

    const ackMessage = thread.post.mock.calls[0][0] as string;
    expect(ackMessage).toContain("*test-artist*");
    expect(ackMessage).not.toContain("**");
    expect(ackMessage).toContain("Lipsync:");
    expect(ackMessage).toContain("Videos:");
  });

  it("adds song URL to songs array when audio is attached", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(extractMessageAttachments).mockResolvedValue({
      songUrl: "https://blob.vercel-storage.com/song.mp3",
      imageUrls: [],
    });
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make a video");
    await bot.getHandler()!(thread, message);

    const payload = vi.mocked(triggerCreateContent).mock.calls[0][0];
    expect(payload.songs).toContain("https://blob.vercel-storage.com/song.mp3");
  });

  it("passes images array to triggerCreateContent when image is attached", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(extractMessageAttachments).mockResolvedValue({
      songUrl: null,
      imageUrls: ["https://blob.vercel-storage.com/face.png"],
    });
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make a video");
    await bot.getHandler()!(thread, message);

    expect(triggerCreateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        images: ["https://blob.vercel-storage.com/face.png"],
      }),
    );
  });

  it("passes all image URLs when multiple images are attached", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-release-editorial",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(extractMessageAttachments).mockResolvedValue({
      songUrl: null,
      imageUrls: [
        "https://blob.vercel-storage.com/face.png",
        "https://blob.vercel-storage.com/cover1.png",
        "https://blob.vercel-storage.com/cover2.png",
      ],
    });
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make an editorial video");
    await bot.getHandler()!(thread, message);

    expect(triggerCreateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          "https://blob.vercel-storage.com/face.png",
          "https://blob.vercel-storage.com/cover1.png",
          "https://blob.vercel-storage.com/cover2.png",
        ],
      }),
    );
  });

  it("omits images from payload when no media is attached", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make a video");
    await bot.getHandler()!(thread, message);

    const payload = vi.mocked(triggerCreateContent).mock.calls[0][0];
    expect(payload).not.toHaveProperty("images");
  });

  it("includes attached media notes in acknowledgment message", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(extractMessageAttachments).mockResolvedValue({
      songUrl: "https://blob.vercel-storage.com/song.mp3",
      imageUrls: ["https://blob.vercel-storage.com/face.png"],
    });
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make a video");
    await bot.getHandler()!(thread, message);

    const ackMessage = thread.post.mock.calls[0][0] as string;
    expect(ackMessage).toContain("Audio: attached file");
    expect(ackMessage).toContain("Images: 1 attached");
  });

  it("includes song names in acknowledgment message", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
      songs: ["hiccups"],
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-1" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make a video for hiccups");
    await bot.getHandler()!(thread, message);

    const ackMessage = thread.post.mock.calls[0][0] as string;
    expect(ackMessage).toContain("Songs:");
    expect(ackMessage).toContain("hiccups");
  });

  it("posts a View Task card with the first run ID after triggering", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(triggerCreateContent).mockResolvedValue({ id: "run-abc-123" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make a video");
    await bot.getHandler()!(thread, message);

    expect(buildTaskCard).toHaveBeenCalledWith(
      "Content Generation Started",
      expect.stringContaining("test-artist"),
      "run-abc-123",
    );
    // Second post call is the card
    expect(thread.post).toHaveBeenCalledWith({ card: { mockCard: true } });
  });

  it("uses the first run ID for View Task card when batch triggers multiple runs", async () => {
    const bot = createMockBot();
    registerOnNewMention(bot as never);

    vi.mocked(parseContentPrompt).mockResolvedValue({
      lipsync: false,
      batch: 3,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
    vi.mocked(resolveArtistSlug).mockResolvedValue("test-artist");
    vi.mocked(getArtistContentReadiness).mockResolvedValue({
      githubRepo: "https://github.com/test/repo",
    } as never);
    vi.mocked(triggerCreateContent)
      .mockResolvedValueOnce({ id: "run-first" })
      .mockResolvedValueOnce({ id: "run-second" })
      .mockResolvedValueOnce({ id: "run-third" });
    vi.mocked(triggerPollContentRun).mockResolvedValue(undefined as never);

    const thread = createMockThread();
    const message = createMockMessage("make 3 videos");
    await bot.getHandler()!(thread, message);

    expect(buildTaskCard).toHaveBeenCalledWith(
      "Content Generation Started",
      expect.any(String),
      "run-first",
    );
  });
});
