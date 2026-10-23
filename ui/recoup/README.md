# Recoup extension

A real MCP Apps UI served by the existing authenticated `/mcp` route. `open_recoup_workflows_sidebar` exposes the OpenAI global/sidebar entrypoint; `open_recoup_workflows` exposes the thread entrypoint and model-invoked UI. Both serve the same `ui://recoup/explore.html` resource. Its library is public product information; it does not expose account data or change tool authorization.

## Conversation routing

Sidebar card clicks send `_meta["openai/message"]: { target: "new", send: true }` when the host advertises that extension. Conversation-panel clicks explicitly target `active`, preserving the current conversation and its artist/song context. The sidebar tool is app-visible only so the model uses the conversation tool. Both entrypoints receive `{}`, so separate tools identify the launch surface; fullscreen display mode cannot distinguish them. The UI reads the tool name from host context, with `messageTarget` in the tool result as a fallback.

A sidebar host without extended message support receives guidance to open Recoup in a conversation panel; it does not silently send to a background thread. Standard MCP Apps messaging still works for conversation launches. Host errors are surfaced without an automatic resend, preventing duplicate requests.

The message target chooses the destination, not the native window layout. OpenAI documents global/sidebar threads and new-chat targeting, but no API to force the chat pane open beside a global app or automatically attach the same UI instance to a new thread. The existing thread entrypoint remains available. Native layout must be checked in ChatGPT after deployment; local protocol tests do not establish that the gallery stays beside the new chat.

## Experience

All 30 workflow cards are organized into looping horizontal sections. Rows recycle the existing offscreen cards instead of cloning them; each workflow has one card and one video element. Video sources are assigned when cards enter view, so offscreen cards do not compete for downloads. Focus a row and use the left/right arrow keys to move one card at a time. Hover expands a card to show its description; clicking the thumbnail or expanded card sends the selected workflow directly into the host conversation. The agent uses existing context and asks for missing essentials. Pending sends block duplicate clicks and failures allow retry. Preview films respect reduced motion and provide readable artwork when loading fails. Files are attached in the host conversation.

Execution belongs to the host agent and existing Recoup skills/tools. Skill names are hints, not a skill installation mechanism. Install the Recoup skills plugin alongside the MCP connection. Tool/skill availability and missing inputs must be checked in the conversation. This version does not run generation inside the gallery, persist projects, upload files, add file handlers, or alter consent. Files are attached in the host conversation. Existing limited-scope connections remain limited; opening the library does not expand them.

## Card naming

Use sentence-case action titles with natural wording and no fixed word count. Use “Create” for generated assets and specific task verbs for research, comparisons, checks, and catalog management. Name the actual task or output, rather than a branded metaphor. Keep stable IDs and skill mappings independent of display names. Existing preview films may contain their original titles until their media is refreshed; changing a catalog title does not edit text baked into a video.

## Dependency boundary

The browser SDKs live in the private `@recoup/explore-ui` workspace. The API uses the SDK version supported by its existing MCP adapter; it registers standard UI resource/tool metadata directly. Browser-only SDK upgrades do not force a change to the shared API transport.

## Build and review

- `pnpm build:extension`: bundle the browser SDK, UI, styles and fonts into one generated TypeScript module plus `ui/recoup/preview.html`. No runtime CDN for scripts or fonts.
- `pnpm test:extension`: protocol discovery/resource and brief validation tests.
- `node scripts/mcp-extension/build-host.mjs`: create a local SDK host harness at `ui/recoup/host.html`. Serve this directory with a loopback static server. The default emulates sidebar message capabilities; `?surface=thread` tests the current-chat route, `?standard` disables extended messaging, and `?delayedFailure` tests rejected sends. The harness shows the received destination and message; it does not simulate native pane layout or send anything to a model or remote service.
- `pnpm dev`, `pnpm build`, `pnpm test` and the OAuth typecheck build the UI first. Rebuild after editing UI source during development.

The original and five new Higgsfield films are referenced by their HTTPS URLs; the publishing card uses an authored eight-second motion graphic served from `/mcp/organize-publishing.mp4`. All films are concept previews, not outputs generated from the current brief. External films depend on their media host remaining available. The CSP allows the existing media origin and the Recoup API origin and no direct API connections. Do not put account files, tokens or private input data in this bundle.

## Host verification after deployment

1. Connect the deployed `/mcp` endpoint with normal Recoup OAuth, or refresh an existing connection's tool metadata.
2. Refresh the connection's tool metadata. Confirm `open_recoup_workflows_sidebar` (global), `open_recoup_workflows` (thread), and the shared `ui://recoup/explore.html` resource are discovered.
3. Open Recoup from the sidebar and a conversation panel. Check light/dark and narrow widths, video playback/pause, reduced motion, keyboard navigation, looping rows and hover expansion.
4. Click a sidebar card: confirm a new chat receives the request, check whether ChatGPT reveals it, and record whether Recoup remains visible alongside it. Open Recoup from a conversation panel and click a card: confirm the existing chat receives it. Verify the agent resolves the intended installed skill. Check a send failure provides feedback and permits retry. If the new chat remains hidden or replaces Recoup, the native acceptance check is incomplete even when message routing passes.
5. Exercise a real authorized workflow with the required inputs and verify its actual output. Gallery handoff alone is not end-to-end generation verification.

Local protocol and harness tests do not prove ChatGPT installation, native entrypoint display, or production workflow execution. Those checks require the deployed branch and a connected host.

References: [OpenAI extensions](https://developers.openai.com/plugins/build/extensions), [extension SDK](https://github.com/openai/mcp-extensions/tree/main/typescript), [MCP Apps](https://github.com/modelcontextprotocol/ext-apps).
