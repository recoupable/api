import { describe, expect, it } from "vitest";
import { isPublicOAuthAddress } from "../isPublicOAuthAddress";
import { validateOAuthMetadataUrl } from "../validateOAuthMetadataUrl";
import { getOAuthMetadataCacheControl } from "../getOAuthMetadataCacheControl";

describe("OAuth metadata network policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.0.1",
    "100.64.0.1",
    "0.0.0.0",
    "192.0.2.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "::ffff:8.8.8.8",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "2002:7f00:1::1",
    "64:ff9b::7f00:1",
    "garbage",
  ])("rejects non-public address %s", address => {
    expect(isPublicOAuthAddress(address)).toBe(false);
  });
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows public address %s", address => {
    expect(isPublicOAuthAddress(address)).toBe(true);
  });
  it.each([
    "http://agent.example/client.json",
    "https://agent.example",
    "https://user:pass@agent.example/client.json",
    "https://agent.example/client.json#fragment",
    "https://localhost/client.json",
    "https://127.1/client.json",
    "https://[::1]/client.json",
    "https://agent.example:8443/client.json",
    "https://agent.example/a/../client.json",
    "https://agent.example/%2e%2e/client.json",
  ])("rejects unsafe URL %s", url => {
    expect(() => validateOAuthMetadataUrl(url)).toThrow();
  });
  it("preserves the URL identity", () => {
    expect(validateOAuthMetadataUrl("https://agent.example/client.json").hostname).toBe(
      "agent.example",
    );
  });
  it("bounds cache freshness and honors no-store, no-cache, Age, and missing headers", () => {
    const policy = (h: Record<string, string>) => getOAuthMetadataCacheControl(new Headers(h));
    expect(policy({ "cache-control": "max-age=99999" })).toBe("max-age=300");
    expect(policy({ "cache-control": "max-age=120", age: "90" })).toBe("max-age=30");
    expect(policy({ "cache-control": "no-store, max-age=300" })).toBe("max-age=0");
    expect(policy({ "cache-control": "no-cache, max-age=300" })).toBe("max-age=0");
    expect(policy({})).toBe("max-age=0");
    expect(policy({ "cache-control": 'foo="x, max-age=999"' })).toBe("max-age=0");
    expect(policy({ "cache-control": "s-maxage=10, max-age=300" })).toBe("max-age=10");
    expect(policy({ "cache-control": "max-age=300, max-age=600" })).toBe("max-age=0");
    expect(
      policy({ "cache-control": "max-age=300", date: new Date(Date.now() - 600000).toUTCString() }),
    ).toBe("max-age=0");
    expect(policy({ expires: new Date(Date.now() + 600000).toUTCString() })).toBe("max-age=300");
    expect(policy({ expires: new Date(Date.now() - 600000).toUTCString() })).toBe("max-age=0");
  });
});
