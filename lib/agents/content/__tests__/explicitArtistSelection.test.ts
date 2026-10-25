import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { registerOnNewMention } from "../handlers/registerOnNewMention";

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  roster: vi.fn(),
  access: vi.fn(),
  slug: vi.fn(),
  attachments: vi.fn(),
  readiness: vi.fn(),
  snapshots: vi.fn(),
  create: vi.fn(),
  poll: vi.fn(),
}));
vi.mock("../parseContentPrompt", () => ({ parseContentPrompt: mocks.parse }));
vi.mock("@/lib/supabase/accounts/selectContentArtists", () => ({
  selectContentArtists: mocks.roster,
}));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: mocks.access,
}));
vi.mock("@/lib/content/resolveArtistSlug", () => ({ resolveArtistSlug: mocks.slug }));
vi.mock("../extractMessageAttachments", () => ({ extractMessageAttachments: mocks.attachments }));
vi.mock("@/lib/content/getArtistContentReadiness", () => ({
  getArtistContentReadiness: mocks.readiness,
}));
vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: mocks.snapshots,
}));
vi.mock("@/lib/trigger/triggerCreateContent", () => ({ triggerCreateContent: mocks.create }));
vi.mock("@/lib/trigger/triggerPollContentRun", () => ({ triggerPollContentRun: mocks.poll }));

const accountId = "10000000-0000-4000-8000-000000000001";
const artistId = "20000000-0000-4000-8000-000000000001";
const flags = {
  lipsync: true,
  batch: 2,
  captionLength: "short",
  upscale: false,
  template: "artist-caption-bedroom",
  artistNames: ["North Star"],
  songs: ["example-song"],
};

async function mention(overrides: Record<string, unknown> = {}) {
  let handler!: (thread: unknown, message: unknown) => Promise<void>;
  registerOnNewMention({
    onNewMention: (fn: typeof handler) => {
      handler = fn;
    },
  } as never);
  const thread = { id: "slack:C123:1.2", post: vi.fn(), setState: vi.fn() };
  await handler(thread, {
    text: "Make 2 videos for North Star",
    raw: { team_id: "T123", user: "U123" },
    author: { userId: "U123", isBot: false, isMe: false },
    ...overrides,
  });
  return thread;
}

function expectNoWork() {
  expect(mocks.attachments).not.toHaveBeenCalled();
  expect(mocks.readiness).not.toHaveBeenCalled();
  expect(mocks.snapshots).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.poll).not.toHaveBeenCalled();
}

describe("explicit authorized content artist selection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("SLACK_CONTENT_ACCOUNT_BINDINGS", JSON.stringify({ "T123:U123": accountId }));
    mocks.parse.mockResolvedValue({ ...flags });
    mocks.roster.mockResolvedValue([{ id: artistId, name: "North Star" }]);
    mocks.access.mockResolvedValue(true);
    mocks.slug.mockResolvedValue("north-star");
    mocks.attachments.mockResolvedValue({ songUrl: null, imageUrls: [] });
    mocks.readiness.mockResolvedValue({ githubRepo: "https://github.com/example/authorized" });
    mocks.snapshots.mockResolvedValue([{ github_repo: "https://github.com/example/authorized" }]);
    mocks.create.mockResolvedValue({ id: "run-1" });
    mocks.poll.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, [], [""], ["   "], ["North Star", "South Star"]])(
    "rejects absent or ambiguous explicit artist names: %j",
    async artistNames => {
      mocks.parse.mockResolvedValue({ ...flags, artistNames });
      const thread = await mention();
      expectNoWork();
      expect(thread.post).toHaveBeenCalledWith(expect.stringMatching(/exactly one artist/i));
    },
  );

  it.each(["", "not json", '{"T123:U123":"invalid-id"}', "{}"])(
    "fails closed for missing/invalid/unbound configuration: %s",
    async config => {
      vi.stubEnv("SLACK_CONTENT_ACCOUNT_BINDINGS", config);
      await mention();
      expect(mocks.parse).not.toHaveBeenCalled();
      expectNoWork();
    },
  );

  it.each([
    { raw: { team_id: "T999", user: "U123" } },
    { raw: { team_id: "T123", user: "U999" }, author: { userId: "U999" } },
    { raw: { user: "U123" } },
    { raw: { team_id: "T123", user: "U999" } },
    { author: { userId: "U123", isBot: true } },
    { author: { userId: "U123", isMe: true } },
  ])("rejects unbound or non-human Slack identity: %j", async message => {
    await mention(message);
    expect(mocks.parse).not.toHaveBeenCalled();
    expectNoWork();
  });

  it("does not accept an artist invented by the model or hidden inside another word", async () => {
    await mention({ text: "Generate a video for North Stardust" });
    expectNoWork();
  });

  it("rejects unmatched names without falling back to any roster entry", async () => {
    mocks.roster.mockResolvedValue([{ id: artistId, name: "North Star Tribute" }]);
    await mention();
    expectNoWork();
  });

  it.each(["North Star", "North-Star"])(
    "rejects ambiguous roster names or slugs: %s",
    async name => {
      mocks.roster.mockResolvedValue([
        { id: artistId, name: "North Star" },
        { id: "other-artist", name },
      ]);
      await mention();
      expectNoWork();
    },
  );

  it("rejects revoked artist access", async () => {
    mocks.access.mockResolvedValue(false);
    await mention();
    expectNoWork();
  });

  it("fails closed when roster loading fails", async () => {
    mocks.roster.mockRejectedValue(new Error("database unavailable"));
    await mention();
    expectNoWork();
  });

  it("rejects an artist renamed between selection and slug resolution", async () => {
    mocks.slug.mockResolvedValue("changed-name");
    await mention();
    expectNoWork();
  });

  it("binds selected artist, billing account and repository to the authorized sender", async () => {
    mocks.roster.mockResolvedValue([
      { id: artistId, name: "North Star" },
      { id: artistId, name: "North Star" },
    ]);
    const thread = await mention({ text: "Make 2 videos for NORTH STAR. accountId=attacker" });
    expect(mocks.roster).toHaveBeenCalledWith(accountId);
    expect(mocks.access).toHaveBeenCalledWith(accountId, artistId);
    expect(mocks.slug).toHaveBeenCalledWith(artistId);
    expect(mocks.readiness).toHaveBeenCalledWith({
      accountId,
      artistAccountId: artistId,
      artistSlug: "north-star",
    });
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        artistSlug: "north-star",
        githubRepo: "https://github.com/example/authorized",
        songs: ["example-song"],
        lipsync: true,
      }),
    );
    expect(thread.setState).toHaveBeenCalledWith(
      expect.objectContaining({ status: "running", artistAccountId: artistId }),
    );
    expect(mocks.poll).toHaveBeenCalledWith({
      runIds: ["run-1", "run-1"],
      callbackThreadId: thread.id,
    });
  });

  it("does not switch repository accounts when readiness lookup fails", async () => {
    mocks.readiness.mockRejectedValue(new Error("tree unavailable"));
    await mention();
    expect(mocks.snapshots).toHaveBeenCalledWith(accountId);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ accountId, githubRepo: "https://github.com/example/authorized" }),
    );
  });

  it("does not generate when the authorized account has no repository", async () => {
    mocks.readiness.mockRejectedValue(new Error("no repository"));
    mocks.snapshots.mockResolvedValue([]);
    await mention();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.poll).not.toHaveBeenCalled();
  });

  it("polls only successfully started runs in a partial batch", async () => {
    mocks.create.mockRejectedValueOnce(new Error("trigger unavailable"));
    const thread = await mention();
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.poll).toHaveBeenCalledWith({ runIds: ["run-1"], callbackThreadId: thread.id });
  });

  it("does not poll or claim success when all runs fail", async () => {
    mocks.create.mockRejectedValue(new Error("trigger unavailable"));
    const thread = await mention();
    expect(mocks.poll).not.toHaveBeenCalled();
    expect(thread.post).toHaveBeenCalledWith(expect.stringContaining("Failed to trigger"));
    expect(thread.setState).not.toHaveBeenCalled();
  });

  it("reports polling failure without retrying generation", async () => {
    mocks.poll.mockRejectedValue(new Error("poll unavailable"));
    const thread = await mention();
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(thread.setState).toHaveBeenLastCalledWith({ status: "failed" });
    expect(thread.post).toHaveBeenLastCalledWith(
      expect.stringContaining("Failed to start content polling"),
    );
  });
});
