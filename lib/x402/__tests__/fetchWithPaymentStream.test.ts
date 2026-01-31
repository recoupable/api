import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWithPaymentStream } from "../fetchWithPaymentStream";
import { getAccount } from "@/lib/coinbase/getAccount";
import { deductCredits } from "@/lib/credits/deductCredits";
import { loadAccount } from "../loadAccount";
import { getCreditsForPrice } from "../getCreditsForPrice";
import { CHAT_PRICE } from "@/lib/const";

// Import x402-fetch to mock wrapFetchWithPayment
import { wrapFetchWithPayment } from "x402-fetch";

// Mock dependencies
vi.mock("@/lib/coinbase/getAccount", () => ({
  getAccount: vi.fn(),
}));

vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: vi.fn(),
}));

vi.mock("../loadAccount", () => ({
  loadAccount: vi.fn(),
}));

vi.mock("../getCreditsForPrice", () => ({
  getCreditsForPrice: vi.fn(),
}));

vi.mock("x402-fetch", () => ({
  wrapFetchWithPayment: vi.fn(() => vi.fn()),
}));

vi.mock("viem/accounts", () => ({
  toAccount: vi.fn(account => account),
}));

vi.mock("viem", () => ({
  parseUnits: vi.fn((value, decimals) => BigInt(Math.round(parseFloat(value) * 10 ** decimals))),
}));

const mockGetAccount = vi.mocked(getAccount);
const mockDeductCredits = vi.mocked(deductCredits);
const mockLoadAccount = vi.mocked(loadAccount);
const mockGetCreditsForPrice = vi.mocked(getCreditsForPrice);
const mockWrapFetchWithPayment = vi.mocked(wrapFetchWithPayment);

describe("fetchWithPaymentStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccount.mockResolvedValue({
      address: "0x1234567890abcdef",
    } as any);
    mockDeductCredits.mockResolvedValue(undefined);
    mockLoadAccount.mockResolvedValue(undefined);
    mockGetCreditsForPrice.mockReturnValue(1);
  });

  it("gets account for the given accountId", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("test"));
    mockWrapFetchWithPayment.mockReturnValue(mockFetch);

    await fetchWithPaymentStream("https://example.com/api", "account-123", { data: "test" });

    expect(mockGetAccount).toHaveBeenCalledWith("account-123");
  });

  it("calculates credits to deduct based on price", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("test"));
    mockWrapFetchWithPayment.mockReturnValue(mockFetch);

    await fetchWithPaymentStream("https://example.com/api", "account-123", { data: "test" });

    expect(mockGetCreditsForPrice).toHaveBeenCalledWith(CHAT_PRICE);
  });

  it("deducts credits from the account", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("test"));
    mockWrapFetchWithPayment.mockReturnValue(mockFetch);
    mockGetCreditsForPrice.mockReturnValue(1);

    await fetchWithPaymentStream("https://example.com/api", "account-123", { data: "test" });

    expect(mockDeductCredits).toHaveBeenCalledWith({
      accountId: "account-123",
      creditsToDeduct: 1,
    });
  });

  it("loads the account wallet with correct price", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("test"));
    mockWrapFetchWithPayment.mockReturnValue(mockFetch);
    mockGetAccount.mockResolvedValue({
      address: "0xWalletAddress123",
    } as any);

    await fetchWithPaymentStream("https://example.com/api", "account-123", { data: "test" });

    expect(mockLoadAccount).toHaveBeenCalledWith("0xWalletAddress123", CHAT_PRICE);
  });

  it("makes POST request with JSON body", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("test"));
    mockWrapFetchWithPayment.mockReturnValue(mockFetch);

    const body = { messages: [{ role: "user", content: "Hello" }] };
    await fetchWithPaymentStream("https://example.com/api", "account-123", body);

    expect(mockFetch).toHaveBeenCalledWith("https://example.com/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  });

  it("returns the response from the wrapped fetch", async () => {
    const expectedResponse = new Response("streaming data", {
      headers: { "Content-Type": "text/event-stream" },
    });
    const mockFetch = vi.fn().mockResolvedValue(expectedResponse);
    mockWrapFetchWithPayment.mockReturnValue(mockFetch);

    const result = await fetchWithPaymentStream("https://example.com/api", "account-123", {
      data: "test",
    });

    expect(result).toBe(expectedResponse);
  });

  it("uses custom price when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("test"));
    mockWrapFetchWithPayment.mockReturnValue(mockFetch);
    mockGetAccount.mockResolvedValue({
      address: "0xCustomAddress",
    } as any);

    await fetchWithPaymentStream(
      "https://example.com/api",
      "account-123",
      { data: "test" },
      "0.05",
    );

    expect(mockGetCreditsForPrice).toHaveBeenCalledWith("0.05");
    expect(mockLoadAccount).toHaveBeenCalledWith("0xCustomAddress", "0.05");
  });

  it("throws error if account retrieval fails", async () => {
    mockGetAccount.mockRejectedValue(new Error("Account not found"));

    await expect(
      fetchWithPaymentStream("https://example.com/api", "account-123", { data: "test" }),
    ).rejects.toThrow("Account not found");
  });

  it("throws error if credit deduction fails", async () => {
    mockDeductCredits.mockRejectedValue(new Error("Insufficient credits"));

    await expect(
      fetchWithPaymentStream("https://example.com/api", "account-123", { data: "test" }),
    ).rejects.toThrow("Insufficient credits");
  });

  it("throws error if account loading fails", async () => {
    mockLoadAccount.mockRejectedValue(new Error("Failed to load account"));

    await expect(
      fetchWithPaymentStream("https://example.com/api", "account-123", { data: "test" }),
    ).rejects.toThrow("Failed to load account");
  });
});
