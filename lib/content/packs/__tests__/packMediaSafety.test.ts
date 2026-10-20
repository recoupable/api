import { describe, expect, it } from "vitest";
import { validatePackMediaBytes } from "../validatePackMediaBytes";
import { isPackPublicAddress } from "../isPackPublicAddress";
describe("pack media boundary", () => {
  it("rejects private and mapped addresses after DNS resolution", () => {
    for (const ip of [
      "127.0.0.1",
      "10.2.3.4",
      "169.254.169.254",
      "192.168.2.2",
      "::1",
      "::ffff:8.8.8.8",
      "fc00::1",
      "2001:db8::1",
    ])
      expect(isPackPublicAddress(ip)).toBe(false);
    expect(isPackPublicAddress("8.8.8.8")).toBe(true);
  });
  it("requires matching bounded binary media, not an HTML response with an audio MIME", () => {
    expect(() =>
      validatePackMediaBytes(Buffer.from("<html>not a song</html>"), "audio/mpeg"),
    ).toThrow();
    expect(
      validatePackMediaBytes(Buffer.from([0x49, 0x44, 0x33, 0, 0, 0, 0, 0]), "audio/mpeg")
        .contentType,
    ).toBe("audio/mpeg");
    expect(() => validatePackMediaBytes(Buffer.alloc(51 * 1024 * 1024), "audio/wav")).toThrow();
  });
});
