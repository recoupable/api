# Recoup Skills over MCP

The authenticated `/mcp` endpoint serves the native Skills extension
(`io.modelcontextprotocol/skills`) to clients using MCP `2026-07-28`.
Connect Claude to `https://api.recoupable.dev/mcp` and authorize Recoup as usual.
In compatible Claude Code sessions, use `/skills` or type
`/recoup:recoup-song-check-credits` if the connection is named `recoup`.

Clients discover the extension with `server/discover`, enumerate skills with
`skills/list`, and read skill files through `resources/read`. Each manifest
includes the original frontmatter and byte digests for the skill's files.
Authenticated customers receive the customer-facing catalog. Recoup staff using
full MCP tools credentials can also retrieve `recoup-internal-*` skills.
Selected Context grants retain their Context-only surface.

Claude Code displays up to 100 skills per server. Its connector scanning rules
can also prevent some larger bundles from loading. The server exposes the
complete authorized catalog through pagination and direct lookup.
[Claude Code MCP skill limits](https://code.claude.com/docs/en/mcp#mcp-skill-limitations)

## Updating the catalog

The [Skills repository](https://github.com/recoupable/skills) owns the skill
source and supports the existing install paths. To release a catalog update,
bump the full Skills commit SHA in `scripts/mcp-skills/build.mjs` and run
`pnpm build:mcp-skills`. The API build downloads that revision, validates it
with the official Skills SDK, and packages its files with the MCP route. A
deployment keeps the same catalog and file digests until the next API release.
