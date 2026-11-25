# Recoup Skills over MCP

Use the Recoup connector at `https://api.recoupable.dev/mcp` and sign in to
Recoup. Signed-in accounts using the standard connector grant can use
customer-facing skills. The connector
also makes internal skills available to Recoup organization members, accounts
with a staff skills grant, and OAuth users whose Recoup sign-in identity has a
currently verified `@recoupable.com` email. These grants apply to skill
content. Recoup tool actions continue to enforce their existing permissions.

In ChatGPT, ask the connected Recoup app to find or use a Recoup skill. The
`recoup_skills` tool searches the authorized catalog and reads skill
instructions and supporting files. ChatGPT's plugin listing shows the skills
included in the submitted plugin package.

Clients with native Skills over MCP support can also use `skills/list`,
`skills/get`, and `resources/read` on the same connection. For Claude Code,
use `/skills` or ask Recoup to find a skill by name if its menu reaches the
client's display limit. Selected Context grants keep their workspace-only
tool surface.

## Granting staff skills access

Use the server-side `RECOUP_STAFF_SKILL_ACCOUNT_IDS` setting for explicit
grants. Set it to a comma-separated list of exact Recoup account IDs.

Use an account with customer-facing access when scanning or packaging the
public plugin so the submitted package contains only customer-facing skills.

## Updating the catalog

The [Skills repository](https://github.com/recoupable/skills) owns the skill
source. To release a catalog update, bump the Skills commit SHA in
`scripts/mcp-skills/build.mjs` and run `pnpm build:mcp-skills`. This validates
the catalog and packages the skill definitions and supporting files with the API.
