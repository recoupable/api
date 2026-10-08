import { expect, it } from "vitest";
import { setOAuthMcpHeaders } from "../setOAuthMcpHeaders";
it("uses the configured issuer in challenges even when Next reports an internal host", () => {
  const response = new Response(null, {
    status: 401,
    headers: { "WWW-Authenticate": 'Bearer resource_metadata="http://localhost/missing"' },
  });
  setOAuthMcpHeaders(response, "https://api.recoupable.dev/api/oauth");
  expect(response.headers.get("WWW-Authenticate")).toBe(
    'Bearer resource_metadata="https://api.recoupable.dev/.well-known/oauth-protected-resource/mcp", scope="mcp:read mcp:write mcp:tools"',
  );
  expect(response.headers.get("Access-Control-Expose-Headers")).toContain("WWW-Authenticate");
});
it("does not advertise a disabled OAuth metadata endpoint", () => {
  const response = new Response(null, {
    status: 401,
    headers: { "WWW-Authenticate": 'Bearer resource_metadata="https://api.example/disabled"' },
  });
  setOAuthMcpHeaders(response);
  expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
});
