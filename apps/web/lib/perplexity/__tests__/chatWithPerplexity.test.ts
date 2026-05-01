import { describe, it, expect, vi, beforeEach } from "vitest";
import { chatWithPerplexity, PerplexityMessage } from "../chatWithPerplexity";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("../config", () => ({
  getPerplexityApiKey: () => "test-api-key",
  getPerplexityHeaders: (apiKey: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }),
  PERPLEXITY_BASE_URL: "https://api.perplexity.ai",
}));

describe("chatWithPerplexity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends correct request to Perplexity API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Response content" } }],
          citations: [],
          search_results: [],
        }),
    });

    const messages: PerplexityMessage[] = [{ role: "user", content: "Test query" }];

    await chatWithPerplexity(messages, "sonar-pro");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.perplexity.ai/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-api-key",
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages,
          stream: false,
        }),
      }),
    );
  });

  it("returns content, citations, and search results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Research findings" } }],
          citations: ["https://example.com/1", "https://example.com/2"],
          search_results: [
            { title: "Source 1", url: "https://example.com/1" },
            { title: "Source 2", url: "https://example.com/2" },
          ],
        }),
    });

    const result = await chatWithPerplexity([{ role: "user", content: "Test" }]);

    expect(result).toEqual({
      content: "Research findings",
      citations: ["https://example.com/1", "https://example.com/2"],
      searchResults: [
        { title: "Source 1", url: "https://example.com/1" },
        { title: "Source 2", url: "https://example.com/2" },
      ],
    });
  });

  it("uses default model when not specified", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Response" } }],
          citations: [],
          search_results: [],
        }),
    });

    await chatWithPerplexity([{ role: "user", content: "Test" }]);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"model":"sonar-pro"'),
      }),
    );
  });

  it("handles API errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: () => Promise.resolve("Rate limit exceeded"),
    });

    await expect(chatWithPerplexity([{ role: "user", content: "Test" }])).rejects.toThrow(
      "Perplexity API error: 429 Too Many Requests",
    );
  });

  it("handles missing fields gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [],
        }),
    });

    const result = await chatWithPerplexity([{ role: "user", content: "Test" }]);

    expect(result).toEqual({
      content: "",
      citations: [],
      searchResults: [],
    });
  });

  it("supports custom models like sonar-deep-research", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Deep research results" } }],
          citations: [],
          search_results: [],
        }),
    });

    await chatWithPerplexity([{ role: "user", content: "Test" }], "sonar-deep-research");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"model":"sonar-deep-research"'),
      }),
    );
  });
});
