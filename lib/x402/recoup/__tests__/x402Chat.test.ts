import { describe, it, expect, vi, beforeEach } from "vitest";
import { x402Chat } from "../x402Chat";
import { fetchWithPaymentStream } from "../../fetchWithPaymentStream";

// Mock fetchWithPaymentStream
vi.mock("../../fetchWithPaymentStream", () => ({
  fetchWithPaymentStream: vi.fn(),
}));

const mockFetchWithPaymentStream = vi.mocked(fetchWithPaymentStream);

describe("x402Chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithPaymentStream.mockResolvedValue(
      new Response("streaming response", {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
  });

  it("calls fetchWithPaymentStream with correct URL", async () => {
    const body = {
      messages: [{ role: "user", content: "Hello" }],
      accountId: "account-123",
      orgId: null,
    } as any;

    await x402Chat(body, "https://api.example.com");

    expect(mockFetchWithPaymentStream).toHaveBeenCalledWith(
      "https://api.example.com/api/x402/chat",
      "account-123",
      expect.any(Object),
    );
  });

  it("includes messages and accountId in request body", async () => {
    const body = {
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
      ],
      accountId: "account-123",
      orgId: null,
    } as any;

    await x402Chat(body, "https://api.example.com");

    expect(mockFetchWithPaymentStream).toHaveBeenCalledWith(
      expect.any(String),
      "account-123",
      expect.objectContaining({
        messages: body.messages,
        accountId: "account-123",
      }),
    );
  });

  it("includes optional prompt in request body", async () => {
    const body = {
      messages: [],
      prompt: "Hello, world!",
      accountId: "account-123",
      orgId: null,
    } as any;

    await x402Chat(body, "https://api.example.com");

    expect(mockFetchWithPaymentStream).toHaveBeenCalledWith(
      expect.any(String),
      "account-123",
      expect.objectContaining({
        prompt: "Hello, world!",
      }),
    );
  });

  it("includes optional roomId in request body", async () => {
    const body = {
      messages: [{ role: "user", content: "Hello" }],
      accountId: "account-123",
      roomId: "room-456",
      orgId: null,
    } as any;

    await x402Chat(body, "https://api.example.com");

    expect(mockFetchWithPaymentStream).toHaveBeenCalledWith(
      expect.any(String),
      "account-123",
      expect.objectContaining({
        roomId: "room-456",
      }),
    );
  });

  it("includes optional artistId in request body", async () => {
    const body = {
      messages: [{ role: "user", content: "Hello" }],
      accountId: "account-123",
      artistId: "artist-789",
      orgId: null,
    } as any;

    await x402Chat(body, "https://api.example.com");

    expect(mockFetchWithPaymentStream).toHaveBeenCalledWith(
      expect.any(String),
      "account-123",
      expect.objectContaining({
        artistId: "artist-789",
      }),
    );
  });

  it("includes organizationId when orgId is provided", async () => {
    const body = {
      messages: [{ role: "user", content: "Hello" }],
      accountId: "account-123",
      orgId: "org-456",
    } as any;

    await x402Chat(body, "https://api.example.com");

    expect(mockFetchWithPaymentStream).toHaveBeenCalledWith(
      expect.any(String),
      "account-123",
      expect.objectContaining({
        organizationId: "org-456",
      }),
    );
  });

  it("does not include organizationId when orgId is null", async () => {
    const body = {
      messages: [{ role: "user", content: "Hello" }],
      accountId: "account-123",
      orgId: null,
    } as any;

    await x402Chat(body, "https://api.example.com");

    const [, , requestBody] = mockFetchWithPaymentStream.mock.calls[0];
    expect(requestBody).not.toHaveProperty("organizationId");
  });

  it("includes optional model in request body", async () => {
    const body = {
      messages: [{ role: "user", content: "Hello" }],
      accountId: "account-123",
      model: "gpt-4",
      orgId: null,
    } as any;

    await x402Chat(body, "https://api.example.com");

    expect(mockFetchWithPaymentStream).toHaveBeenCalledWith(
      expect.any(String),
      "account-123",
      expect.objectContaining({
        model: "gpt-4",
      }),
    );
  });

  it("includes optional excludeTools in request body", async () => {
    const body = {
      messages: [{ role: "user", content: "Hello" }],
      accountId: "account-123",
      excludeTools: ["tool1", "tool2"],
      orgId: null,
    } as any;

    await x402Chat(body, "https://api.example.com");

    expect(mockFetchWithPaymentStream).toHaveBeenCalledWith(
      expect.any(String),
      "account-123",
      expect.objectContaining({
        excludeTools: ["tool1", "tool2"],
      }),
    );
  });

  it("returns the streaming response", async () => {
    const expectedResponse = new Response("streaming data", {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
    mockFetchWithPaymentStream.mockResolvedValue(expectedResponse);

    const body = {
      messages: [{ role: "user", content: "Hello" }],
      accountId: "account-123",
      orgId: null,
    } as any;

    const result = await x402Chat(body, "https://api.example.com");

    expect(result).toBe(expectedResponse);
  });

  it("propagates errors from fetchWithPaymentStream", async () => {
    mockFetchWithPaymentStream.mockRejectedValue(new Error("Payment failed"));

    const body = {
      messages: [{ role: "user", content: "Hello" }],
      accountId: "account-123",
      orgId: null,
    } as any;

    await expect(x402Chat(body, "https://api.example.com")).rejects.toThrow("Payment failed");
  });

  it("handles all optional fields together", async () => {
    const body = {
      messages: [{ role: "user", content: "Hello" }],
      prompt: "Additional prompt",
      accountId: "account-123",
      roomId: "room-456",
      artistId: "artist-789",
      orgId: "org-abc",
      model: "gpt-4",
      excludeTools: ["tool1"],
    } as any;

    await x402Chat(body, "https://api.example.com");

    expect(mockFetchWithPaymentStream).toHaveBeenCalledWith(
      "https://api.example.com/api/x402/chat",
      "account-123",
      {
        messages: body.messages,
        prompt: "Additional prompt",
        accountId: "account-123",
        roomId: "room-456",
        artistId: "artist-789",
        organizationId: "org-abc",
        model: "gpt-4",
        excludeTools: ["tool1"],
      },
    );
  });
});
