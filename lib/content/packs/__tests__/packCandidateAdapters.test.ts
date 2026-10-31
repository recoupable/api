import { afterEach, expect, it, vi } from "vitest";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { analyzePackAudioWithGemini } from "../analyzePackAudioWithGemini";
import { generatePackTextWithLuna } from "../generatePackTextWithLuna";

// Real installed SDK serializers, synthetic HTTP responses, no credentials/network.
const observations = {
  summary: "Soft percussion and warm bass",
  visual_direction: "Amber paper textures",
  proposed_start_seconds: 12,
};
function googleFixture(text = JSON.stringify(observations), finishReason = "STOP", status = 200) {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify(
          status === 200
            ? {
                candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason }],
                usageMetadata: {
                  promptTokenCount: 10,
                  candidatesTokenCount: 10,
                  totalTokenCount: 20,
                },
              }
            : { error: { message: "Fixture unavailable" } },
        ),
        { status, headers: { "content-type": "application/json" } },
      ),
  );
  return {
    fetch,
    model: createGoogleGenerativeAI({ apiKey: "fixture", fetch })("gemini-3.8-flash"),
  };
}
function lunaFixture(text = "A grounded caption", finish_reason = "stop", status = 200) {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify(
          status === 200
            ? {
                id: "fixture",
                object: "chat.completion",
                created: 0,
                model: "gpt-6-luna",
                choices: [
                  { index: 0, message: { role: "assistant", content: text }, finish_reason },
                ],
                usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
              }
            : { error: { message: "Fixture unavailable", type: "server_error" } },
        ),
        { status, headers: { "content-type": "application/json" } },
      ),
  );
  return { fetch, model: createOpenAI({ apiKey: "fixture", fetch }).chat("gpt-6-luna") };
}
const audio = {
  bytes: Buffer.from("synthetic audio"),
  mediaType: "audio/wav",
  durationSeconds: 60,
  clipSeconds: 10,
  prompt: "Listen to the supplied recording; return the bounded analysis JSON.",
};
afterEach(() => vi.unstubAllGlobals());
it("sends inline audio to Gemini with bounded output and low thinking", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unmocked network");
    }),
  );
  const fixture = googleFixture();
  await expect(analyzePackAudioWithGemini({ ...audio, model: fixture.model })).resolves.toEqual(
    observations,
  );
  const body = JSON.parse(
    (fixture.fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
  );
  expect(body.contents[0].parts).toContainEqual({
    inlineData: { mimeType: "audio/wav", data: audio.bytes.toString("base64") },
  });
  expect(body.generationConfig).toMatchObject({
    maxOutputTokens: 2048,
    thinkingConfig: { thinkingLevel: "low", includeThoughts: false },
  });
  expect(fixture.fetch).toHaveBeenCalledTimes(1);
});
it.each([
  "",
  "not JSON",
  JSON.stringify({ ...observations, summary: "unknown" }),
  JSON.stringify({ ...observations, proposed_start_seconds: 51 }),
])("rejects unusable audio interpretation %s", async text => {
  const fixture = googleFixture(text);
  await expect(analyzePackAudioWithGemini({ ...audio, model: fixture.model })).rejects.toThrow();
  expect(fixture.fetch).toHaveBeenCalledTimes(1);
});
it("rejects parseable but truncated audio output", async () => {
  const fixture = googleFixture(JSON.stringify(observations), "MAX_TOKENS");
  await expect(analyzePackAudioWithGemini({ ...audio, model: fixture.model })).rejects.toThrow(
    /incomplete/i,
  );
});
it.each([NaN, 9, 1201])("rejects invalid duration before a call: %s", async durationSeconds => {
  const fixture = googleFixture();
  await expect(
    analyzePackAudioWithGemini({ ...audio, durationSeconds, model: fixture.model }),
  ).rejects.toThrow();
  expect(fixture.fetch).not.toHaveBeenCalled();
});
it.each(["caption", "stillInspection"] as const)(
  "serializes explicit Luna reasoning and output cap for %s",
  async stage => {
    const fixture = lunaFixture();
    await expect(
      generatePackTextWithLuna({
        model: fixture.model,
        prompt: "Fixture instruction",
        ...(stage === "caption"
          ? { stage }
          : { stage, image: Buffer.from("synthetic image"), mediaType: "image/png" }),
      }),
    ).resolves.toBe("A grounded caption");
    const body = JSON.parse(
      (fixture.fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body).toMatchObject({
      model: "gpt-6-luna",
      reasoning_effort: "none",
      max_completion_tokens: stage === "caption" ? 350 : 600,
    });
    expect(body).not.toHaveProperty("max_tokens");
    if (stage === "stillInspection")
      expect(body.messages[0].content).toContainEqual({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${Buffer.from("synthetic image").toString("base64")}`,
        },
      });
  },
);
it.each([
  ["", "stop"],
  ["partial text", "length"],
  ["blocked", "content_filter"],
])("rejects unusable Luna result %s/%s", async (text, reason) => {
  const fixture = lunaFixture(text, reason);
  await expect(
    generatePackTextWithLuna({ model: fixture.model, stage: "caption", prompt: "Fixture" }),
  ).rejects.toThrow();
  expect(fixture.fetch).toHaveBeenCalledTimes(1);
});
it("does not retry either provider after a transient error", async () => {
  const google = googleFixture("", "STOP", 503);
  const luna = lunaFixture("", "stop", 503);
  await expect(analyzePackAudioWithGemini({ ...audio, model: google.model })).rejects.toThrow();
  await expect(
    generatePackTextWithLuna({ model: luna.model, stage: "caption", prompt: "Fixture" }),
  ).rejects.toThrow();
  expect(google.fetch).toHaveBeenCalledTimes(1);
  expect(luna.fetch).toHaveBeenCalledTimes(1);
});
it("rejects unqualified model and transport substitutions before invocation", async () => {
  const fixture = lunaFixture();
  await expect(analyzePackAudioWithGemini({ ...audio, model: fixture.model })).rejects.toThrow(
    /model/i,
  );
  const responses = createOpenAI({ apiKey: "fixture", fetch: fixture.fetch }).responses(
    "gpt-6-luna",
  );
  await expect(
    generatePackTextWithLuna({ model: responses, stage: "caption", prompt: "Fixture" }),
  ).rejects.toThrow(/model/i);
  expect(fixture.fetch).not.toHaveBeenCalled();
});
it.each([{ bytes: Buffer.alloc(10 * 1024 * 1024 + 1) }, { prompt: "a".repeat(12_001) }])(
  "rejects oversized inline input before a provider call",
  async override => {
    const fixture = googleFixture();
    await expect(
      analyzePackAudioWithGemini({ ...audio, ...override, model: fixture.model }),
    ).rejects.toThrow();
    expect(fixture.fetch).not.toHaveBeenCalled();
  },
);
it.each(["\u200b", "\ufe0f", "\u2060\u200d"])(
  "rejects invisible-only Luna output %j",
  async text => {
    const fixture = lunaFixture(text);
    await expect(
      generatePackTextWithLuna({ model: fixture.model, stage: "caption", prompt: "Fixture" }),
    ).rejects.toThrow(/no text/i);
  },
);
it.each(["静かな夜", "موسيقى", "🎵"])(
  "preserves substantive Unicode Luna output %s",
  async text => {
    const fixture = lunaFixture(text);
    await expect(
      generatePackTextWithLuna({ model: fixture.model, stage: "caption", prompt: "Fixture" }),
    ).resolves.toBe(text);
  },
);
