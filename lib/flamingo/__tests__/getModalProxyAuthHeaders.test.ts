import { describe, it, expect, vi, afterEach } from "vitest";
import { getModalProxyAuthHeaders } from "../getModalProxyAuthHeaders";

describe("getModalProxyAuthHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns Modal-Key and Modal-Secret when both env vars are set", () => {
    vi.stubEnv("MODAL_PROXY_TOKEN_ID", "wk-test-id");
    vi.stubEnv("MODAL_PROXY_TOKEN_SECRET", "ws-test-secret");

    expect(getModalProxyAuthHeaders()).toEqual({
      "Modal-Key": "wk-test-id",
      "Modal-Secret": "ws-test-secret",
    });
  });

  it("returns no headers when the env vars are unset", () => {
    vi.stubEnv("MODAL_PROXY_TOKEN_ID", "");
    vi.stubEnv("MODAL_PROXY_TOKEN_SECRET", "");

    expect(getModalProxyAuthHeaders()).toEqual({});
  });

  it("returns no headers when only one env var is set", () => {
    vi.stubEnv("MODAL_PROXY_TOKEN_ID", "wk-test-id");
    vi.stubEnv("MODAL_PROXY_TOKEN_SECRET", "");

    expect(getModalProxyAuthHeaders()).toEqual({});
  });
});
