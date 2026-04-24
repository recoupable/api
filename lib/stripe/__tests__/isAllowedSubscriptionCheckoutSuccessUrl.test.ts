import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAllowedSubscriptionCheckoutSuccessUrl } from "../isAllowedSubscriptionCheckoutSuccessUrl";

describe("isAllowedSubscriptionCheckoutSuccessUrl", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows production chat origin", () => {
    expect(
      isAllowedSubscriptionCheckoutSuccessUrl(
        "https://chat.recoupable.com/chat?subscription=success",
      ),
    ).toBe(true);
  });

  it("allows localhost", () => {
    expect(
      isAllowedSubscriptionCheckoutSuccessUrl("http://localhost:3000/?subscription=success"),
    ).toBe(true);
  });

  it("allows origin from SUBSCRIPTION_CHECKOUT_SUCCESS_EXTRA_ORIGINS", () => {
    process.env.SUBSCRIPTION_CHECKOUT_SUCCESS_EXTRA_ORIGINS = "https://custom-preview.example.com";
    expect(
      isAllowedSubscriptionCheckoutSuccessUrl(
        "https://custom-preview.example.com/welcome?subscription=success",
      ),
    ).toBe(true);
  });

  it("allows recoup-chat *.vercel.app when VERCEL_ENV is preview", () => {
    process.env.VERCEL_ENV = "preview";
    expect(
      isAllowedSubscriptionCheckoutSuccessUrl(
        "https://recoup-chat-j1st15gap-recoupable-ad724970.vercel.app/chat?subscription=success",
      ),
    ).toBe(true);
  });

  it("rejects recoup-chat vercel preview when VERCEL_ENV is production", () => {
    process.env.VERCEL_ENV = "production";
    expect(
      isAllowedSubscriptionCheckoutSuccessUrl(
        "https://recoup-chat-j1st15gap-recoupable-ad724970.vercel.app/chat?subscription=success",
      ),
    ).toBe(false);
  });

  it("rejects unknown origins", () => {
    process.env.VERCEL_ENV = "preview";
    expect(
      isAllowedSubscriptionCheckoutSuccessUrl("https://evil.example.com/ok?subscription=success"),
    ).toBe(false);
  });
});
