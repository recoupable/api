import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadAccount } from "../loadAccount";
import { sendUserOpAndWait } from "@/lib/coinbase/sendUserOpAndWait";
import { getTransferCalls } from "@/lib/x402/getTransferCalls";
import { IMAGE_GENERATE_PRICE, CHAT_PRICE } from "@/lib/const";

// Mock dependencies
vi.mock("@/lib/coinbase/sendUserOpAndWait", () => ({
  sendUserOpAndWait: vi.fn(),
}));

vi.mock("@/lib/x402/getTransferCalls", () => ({
  getTransferCalls: vi.fn(),
}));

const mockSendUserOpAndWait = vi.mocked(sendUserOpAndWait);
const mockGetTransferCalls = vi.mocked(getTransferCalls);

describe("loadAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendUserOpAndWait.mockResolvedValue("0xTransactionHash123");
    mockGetTransferCalls.mockReturnValue([{ to: "0x123", data: "0x" }] as never);
  });

  it("sends USDC to the recipient address", async () => {
    const recipientAddress = "0xRecipient123" as `0x${string}`;

    await loadAccount(recipientAddress, IMAGE_GENERATE_PRICE);

    expect(mockGetTransferCalls).toHaveBeenCalledWith(recipientAddress, IMAGE_GENERATE_PRICE);
    expect(mockSendUserOpAndWait).toHaveBeenCalled();
  });

  it("uses the provided price for the transfer", async () => {
    const recipientAddress = "0xRecipient456" as `0x${string}`;

    await loadAccount(recipientAddress, CHAT_PRICE);

    expect(mockGetTransferCalls).toHaveBeenCalledWith(recipientAddress, CHAT_PRICE);
  });

  it("returns the transaction hash", async () => {
    mockSendUserOpAndWait.mockResolvedValue("0xSuccessHash");
    const recipientAddress = "0xRecipient789" as `0x${string}`;

    const result = await loadAccount(recipientAddress, IMAGE_GENERATE_PRICE);

    expect(result).toBe("0xSuccessHash");
  });

  it("throws error when sendUserOpAndWait fails", async () => {
    mockSendUserOpAndWait.mockRejectedValue(new Error("Transaction failed"));
    const recipientAddress = "0xRecipientFail" as `0x${string}`;

    await expect(loadAccount(recipientAddress, IMAGE_GENERATE_PRICE)).rejects.toThrow(
      "Failed to load account and send USDC: Transaction failed",
    );
  });

  it("passes different prices correctly", async () => {
    const recipientAddress = "0xRecipient" as `0x${string}`;

    // Test with image price
    await loadAccount(recipientAddress, "0.15");
    expect(mockGetTransferCalls).toHaveBeenLastCalledWith(recipientAddress, "0.15");

    // Test with chat price
    await loadAccount(recipientAddress, "0.01");
    expect(mockGetTransferCalls).toHaveBeenLastCalledWith(recipientAddress, "0.01");

    // Test with custom price
    await loadAccount(recipientAddress, "0.50");
    expect(mockGetTransferCalls).toHaveBeenLastCalledWith(recipientAddress, "0.50");
  });
});
