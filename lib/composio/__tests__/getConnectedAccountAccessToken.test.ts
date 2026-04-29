import { describe, it, expect, vi, beforeEach } from "vitest";
import { getConnectedAccountAccessToken } from "../getConnectedAccountAccessToken";

const getMock = vi.fn();
vi.mock("../client", () => ({
  getComposioClient: vi.fn(async () => ({
    connectedAccounts: { get: getMock },
  })),
}));

describe("getConnectedAccountAccessToken", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("returns access and refresh tokens for an ACTIVE OAUTH2 account", async () => {
    getMock.mockResolvedValueOnce({
      status: "ACTIVE",
      state: { authScheme: "OAUTH2", val: { access_token: "tok", refresh_token: "rt" } },
    });

    const result = await getConnectedAccountAccessToken("con_abc");
    expect(result).toEqual({ accessToken: "tok", refreshToken: "rt" });
    expect(getMock).toHaveBeenCalledWith("con_abc");
  });

  it("returns null refreshToken when missing", async () => {
    getMock.mockResolvedValueOnce({
      status: "ACTIVE",
      state: { authScheme: "OAUTH2", val: { access_token: "tok" } },
    });

    const result = await getConnectedAccountAccessToken("con_abc");
    expect(result).toEqual({ accessToken: "tok", refreshToken: null });
  });

  it("throws when status is not ACTIVE", async () => {
    getMock.mockResolvedValueOnce({
      status: "EXPIRED",
      state: { authScheme: "OAUTH2", val: { access_token: "tok" } },
    });

    await expect(getConnectedAccountAccessToken("con_abc")).rejects.toThrow(/not active/);
  });

  it("throws when access_token is missing", async () => {
    getMock.mockResolvedValueOnce({
      status: "ACTIVE",
      state: { authScheme: "OAUTH2", val: {} },
    });

    await expect(getConnectedAccountAccessToken("con_abc")).rejects.toThrow(/no access_token/);
  });
});
