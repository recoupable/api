import { afterEach, expect, it, vi } from "vitest";
import { App } from "@modelcontextprotocol/ext-apps";
import { AppBridge } from "@modelcontextprotocol/ext-apps/app-bridge";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { OpenAIMessageParamsSchema } from "@openai/mcp-extensions/app";
import { z } from "zod";
import { createHostBridge } from "../createHostBridge";
import { startExperience } from "../startExperience";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function host({ sidebar = true, extended = true, fails = false, toolInfo = true } = {}) {
  // Replace only the browser transport and resize observer; use the real SDK handshake/message path.
  const [appTransport, hostTransport] = InMemoryTransport.createLinkedPair();
  const bridge = new AppBridge(
    null,
    { name: "test host", version: "1" },
    {
      message: { text: {} },
      ...(extended ? { experimental: { "openai/message": {} } } : {}),
    },
    {
      hostContext: {
        ...(toolInfo
          ? {
              toolInfo: {
                tool: {
                  name: sidebar ? "open_recoup_workflows_sidebar" : "open_recoup_workflows",
                  inputSchema: { type: "object" },
                },
              },
            }
          : {}),
      },
    },
  );
  const received = vi.fn(async (_params: Parameters<NonNullable<AppBridge["onmessage"]>>[0]) =>
    fails ? { isError: true } : {},
  );
  if (extended) {
    // Standard AppBridge intentionally strips extension metadata. A ChatGPT-like
    // host must accept OpenAI's message schema before applying its target.
    bridge.setRequestHandler(
      z.object({ method: z.literal("ui/message"), params: OpenAIMessageParamsSchema }),
      async ({ params }) => received(params),
    );
  } else {
    bridge.onmessage = received;
  }
  await bridge.connect(hostTransport);
  const connect = App.prototype.connect;
  let closeApp = async () => {};
  vi.spyOn(App.prototype, "setupSizeChangedNotifications").mockReturnValue(() => {});
  vi.spyOn(App.prototype, "connect").mockImplementation(function (this: App) {
    closeApp = () => this.close();
    return connect.call(this, appTransport);
  });
  vi.stubGlobal("window", { parent: {} });
  const status = { textContent: "", classList: { add: vi.fn(), remove: vi.fn() } };
  const cards = { setAttribute: vi.fn(), removeAttribute: vi.fn() };
  const send = createHostBridge(status as unknown as HTMLElement);
  await vi.waitFor(() => expect(status.textContent).toContain("Connected"));
  return {
    received,
    status,
    bridge,
    open: startExperience(send, status as unknown as HTMLElement, cards as unknown as HTMLElement),
    close: async () => {
      await closeApp();
      await bridge.close();
    },
  };
}

it("routes a sidebar card to a new chat instead of the sidebar's background thread", async () => {
  const h = await host();
  try {
    await h.open("film");
    expect(h.received).toHaveBeenCalledOnce();
    expect(h.received.mock.calls[0][0]).toMatchObject({
      role: "user",
      content: [{ type: "text", text: expect.stringContaining("recoup-music-video") }],
      _meta: { "openai/message": { target: "new", send: true } },
    });
  } finally {
    await h.close();
  }
});

it("uses the server's launch target when the host omits tool metadata", async () => {
  const h = await host({ toolInfo: false });
  try {
    await h.bridge.sendToolResult({ content: [], structuredContent: { messageTarget: "new" } });
    await vi.waitFor(() => expect(h.status.textContent).toContain("Choose"));
    await h.open("film");
    expect(h.received.mock.calls[0][0]).toMatchObject({
      _meta: { "openai/message": { target: "new", send: true } },
    });
  } finally {
    await h.close();
  }
});

it("does not guess the destination before launch context arrives", async () => {
  const h = await host({ toolInfo: false });
  try {
    await h.open("film");
    expect(h.received).not.toHaveBeenCalled();
    expect(h.status.textContent).toContain("still loading");
  } finally {
    await h.close();
  }
});

it("keeps a conversation-panel card in its existing chat", async () => {
  const h = await host({ sidebar: false });
  try {
    await h.open("film");
    expect(h.received.mock.calls[0][0]).toMatchObject({
      _meta: { "openai/message": { target: "active", send: true } },
    });
  } finally {
    await h.close();
  }
});

it("does not silently start hidden work when a sidebar host lacks new-chat support", async () => {
  const h = await host({ extended: false });
  try {
    await h.open("film");
    expect(h.received).not.toHaveBeenCalled();
    expect(h.status.textContent).toContain("conversation panel");
  } finally {
    await h.close();
  }
});

it("preserves standard MCP Apps messaging inside a conversation", async () => {
  const h = await host({ sidebar: false, extended: false });
  try {
    await h.open("film");
    expect(h.received).toHaveBeenCalledOnce();
    expect(h.received.mock.calls[0][0]).not.toHaveProperty("_meta");
  } finally {
    await h.close();
  }
});

it("reports a host rejection without sending a second message", async () => {
  const h = await host({ fails: true });
  try {
    await h.open("film");
    expect(h.received).toHaveBeenCalledOnce();
    expect(h.status.textContent).toContain("try again");
  } finally {
    await h.close();
  }
});
