# Recoup Skills over MCP

Recoup serves the native Skills extension (`io.modelcontextprotocol/skills`)
to clients using MCP `2026-07-28`.

## Claude Code setup

Connect Recoup for customer-facing skills and tools. Recoup staff can add the
second connection for internal skills. Authorize Recoup Staff with the full
tools permission and an account in the Recoup organization.

```sh
claude mcp add --transport http recoup https://api.recoupable.dev/mcp
claude mcp add --transport http recoup-staff https://api.recoupable.dev/mcp/staff
```

Use `/skills` to find skills from both connections. For example, use
`/recoup:recoup-song-check-credits` or `/recoup-staff:recoup-internal-weekly-usage-review`.
Existing Recoup connections already use the first endpoint. Recoup Staff serves
skills and their resources. Recoup serves the tools those skills may need.
Selected Context grants retain their Context-only surface.

Both catalogs fit within Claude Code's 100-skill limit per connection.
[Claude Code MCP skill limits](https://code.claude.com/docs/en/mcp#mcp-skill-limitations)

## Updating the catalog

The [Skills repository](https://github.com/recoupable/skills) owns the skill
source and supports the existing install paths. To release a catalog update,
bump the full Skills commit SHA in `scripts/mcp-skills/build.mjs` and run
`pnpm build:mcp-skills`. The build validates both catalogs and checks their
sizes against Claude Code's limit. Each deployment packages the same skill
definitions and supporting files until the next API release.
