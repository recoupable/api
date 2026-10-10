import { describe, expect, it } from "vitest";
import { parseCatalogMetadataResponse } from "../parseCatalogMetadataResponse";
describe("parseCatalogMetadataResponse", () => {
  it("validates double-quoted JSON text", () => {
    const result = parseCatalogMetadataResponse(
      '{"genre": "Pop", "tempo_bpm": 120, "mood": ["bright"], "energy_level": 7}',
    );
    expect(result).toEqual({
      status: "valid",
      parsed: { genre: "Pop", tempo_bpm: 120, mood: ["bright"], energy_level: 7 },
    });
  });
  it("validates a Python-style dict and drops fields outside the preset contract", () => {
    const result = parseCatalogMetadataResponse(
      "{'genre': 'Hip hop', 'subgenres': ['trap'], 'key': 'F minor', 'extra': True}",
    );
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.parsed).toEqual({ genre: "Hip hop", subgenres: ["trap"], key: "F minor" });
      expect(result.parsed).not.toHaveProperty("extra");
    }
  });
  it("accepts an object the production endpoint already parsed", () => {
    const result = parseCatalogMetadataResponse({ genre: "Jazz", instruments: ["piano"] });
    expect(result).toEqual({ status: "valid", parsed: { genre: "Jazz", instruments: ["piano"] } });
  });
  it("marks prose as invalid and retains the raw length without throwing", () => {
    const prose = "This track is an upbeat pop song with bright synths.";
    expect(parseCatalogMetadataResponse(prose)).toEqual({
      status: "invalid",
      reason: expect.stringContaining("JSON"),
      rawLength: prose.length,
    });
  });
  it("marks wrongly typed, non-object and empty structured output as invalid", () => {
    expect(parseCatalogMetadataResponse('{"tempo_bpm": "fast"}').status).toBe("invalid");
    expect(parseCatalogMetadataResponse('["Pop"]').status).toBe("invalid");
    expect(parseCatalogMetadataResponse("{}").status).toBe("invalid");
    expect(parseCatalogMetadataResponse(null).status).toBe("invalid");
  });
});
