import { describe, it, expect, vi, afterEach } from "vitest";
import { getRandomCityName } from "@/lib/sessions/getRandomCityName";
import { cityNames } from "@/lib/sessions/cityNames";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getRandomCityName", () => {
  it("returns a city from the curated list when none are used", () => {
    const result = getRandomCityName(new Set());
    expect(cityNames).toContain(result);
  });

  it("avoids cities that are already in use", () => {
    const used = new Set(cityNames.slice(0, cityNames.length - 1));
    const result = getRandomCityName(used);
    expect(result).toBe(cityNames[cityNames.length - 1]);
  });

  it("appends a numeric suffix once every city is used", () => {
    const used = new Set(cityNames);
    const result = getRandomCityName(used);
    expect(result).toMatch(/ \d+$/);
    const base = result.replace(/ \d+$/, "");
    expect(cityNames).toContain(base);
  });

  it("increments the suffix when the next number is also used", () => {
    const baseCity = cityNames[0];
    const used = new Set([...cityNames, `${baseCity} 2`, `${baseCity} 3`]);
    // Pin Math.random so the fallback always picks index 0 (= baseCity),
    // making the suffix-increment behavior deterministic to assert.
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = getRandomCityName(used);

    expect(result).toBe(`${baseCity} 4`);
  });
});
