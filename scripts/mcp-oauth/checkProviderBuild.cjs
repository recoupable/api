const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

// Both routing systems must ship the native provider. Its model class names
// select persistent storage namespaces and cannot survive bundle minification.
for (const route of ["app/mcp/route", "pages/api/oauth/[...path]"]) {
  const trace = JSON.parse(readFileSync(`.next/server/${route}.js.nft.json`, "utf8"));
  assert.ok(
    trace.files.some(file => file.endsWith("/oidc-provider/lib/models/base_model.js")),
    `${route} must ship oidc-provider externally to preserve OAuth storage model names`,
  );
}

console.log("OAuth provider is external in both issuer and MCP deployment traces.");
