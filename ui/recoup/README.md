# Recoup extension

A real MCP Apps UI served by the existing authenticated `/mcp` route. The `open_recoup_workflows` tool exposes OpenAI global/sidebar and thread entrypoints and a standard MCP Apps resource for other compatible hosts. Its library is public product information; it does not expose account data or change tool authorization.

## Experience

All 30 workflow cards are organized into looping horizontal sections. Rows recycle the existing offscreen cards instead of cloning them; each workflow has one card and one video element. Video sources are assigned when cards enter view, so offscreen cards do not compete for downloads. Focus a row and use the left/right arrow keys to move one card at a time. Hover expands a card to show its description; clicking the thumbnail or expanded card sends the selected workflow directly into the host conversation. The agent uses existing context and asks for missing essentials. Pending sends block duplicate clicks and failures allow retry. Preview films respect reduced motion and provide readable artwork when loading fails. Files are attached in the host conversation.

Execution belongs to the host agent and existing Recoup skills/tools. Skill names are hints, not a skill installation mechanism. Install the Recoup skills plugin alongside the MCP connection. Tool/skill availability and missing inputs must be checked in the conversation. This version does not run generation inside the gallery, persist projects, upload files, add file handlers, or alter consent. Files are attached in the host conversation. Existing limited-scope connections remain limited; opening the library does not expand them.

## Dependency boundary

The browser SDKs live in the private `@recoup/explore-ui` workspace. The API uses the SDK version supported by its existing MCP adapter; it registers standard UI resource/tool metadata directly. Browser-only SDK upgrades do not force a change to the shared API transport.

## Build and review

- `pnpm build:extension`: bundle the browser SDK, UI, styles and fonts into one generated TypeScript module plus `ui/recoup/preview.html`. No runtime CDN for scripts or fonts.
- `pnpm test:extension`: protocol discovery/resource and brief validation tests.
- `node scripts/mcp-extension/build-host.mjs`: create a local SDK host harness at `ui/recoup/host.html`. Serve this directory with a loopback static server. The harness shows received messages; it does not send them to a model or remote service.
- `pnpm dev`, `pnpm build`, `pnpm test` and the OAuth typecheck build the UI first. Rebuild after editing UI source during development.

The original and five new Higgsfield films are referenced by their HTTPS URLs; the publishing card uses an authored eight-second motion graphic served from `/mcp/organize-publishing.mp4`. All films are concept previews, not outputs generated from the current brief. External films depend on their media host remaining available. The CSP allows the existing media origin and the Recoup API origin and no direct API connections. Do not put account files, tokens or private input data in this bundle.

## Host verification after deployment

1. Connect the deployed `/mcp` endpoint with normal Recoup OAuth, or refresh an existing connection's tool metadata.
2. Confirm `open_recoup_workflows`, `ui://recoup/explore.html`, and both global/thread entrypoints are discovered.
3. Open Recoup from the sidebar and a conversation panel. Check light/dark and narrow widths, video playback/pause, reduced motion, keyboard navigation, looping rows and hover expansion.
4. Click a card. Verify its request reaches the correct conversation and the agent resolves the intended installed skill. Check a send failure provides feedback and permits retry.
5. Exercise a real authorized workflow with the required inputs and verify its actual output. Gallery handoff alone is not end-to-end generation verification.

Local protocol and harness tests do not prove ChatGPT installation, native entrypoint display, or production workflow execution. Those checks require the deployed branch and a connected host.

References: [OpenAI extensions](https://developers.openai.com/plugins/build/extensions), [extension SDK](https://github.com/openai/mcp-extensions/tree/main/typescript), [MCP Apps](https://github.com/modelcontextprotocol/ext-apps).
