import { describe, expect, it } from "vitest";
import { normalizeLuminateStreams } from "../normalizeLuminateStreams";

const request = { isrc: "USAAA2400001", since: "2026-09-01", until: "2026-09-02" };
const payload = () => ({
  id: "MR-test",
  isrc: request.isrc,
  location: "AA",
  start_date: request.since,
  end_date: request.until,
  metrics: [
    {
      name: "Streams",
      value: [
        {
          name: "total",
          value: [
            { date: request.since, value: 1 },
            { date: request.until, value: 0 },
          ],
        },
      ],
    },
  ],
});

describe("normalizeLuminateStreams", () => {
  it("preserves exact low counts and explicit zero days", () => {
    expect(normalizeLuminateStreams(payload(), request).days).toEqual([
      { date: request.since, streams: 1 },
      { date: request.until, streams: 0 },
    ]);
  });
  it("preserves missing dates rather than filling zeros", () => {
    const data = payload();
    data.metrics[0].value[0].value.pop();
    expect(normalizeLuminateStreams(data, request).days).toHaveLength(1);
  });
  it.each(["identity", "territory", "range", "duplicate", "negative", "unsafe", "metric"])(
    "rejects %s mismatch",
    kind => {
      const data = payload();
      if (kind === "identity") data.isrc = "USAAA2400002";
      if (kind === "territory") data.location = "US";
      if (kind === "range") data.metrics[0].value[0].value[0].date = "2026-08-31";
      if (kind === "duplicate")
        data.metrics[0].value[0].value.push(data.metrics[0].value[0].value[0]);
      if (kind === "negative") data.metrics[0].value[0].value[0].value = -1;
      if (kind === "unsafe") data.metrics[0].value[0].value[0].value = Number.MAX_SAFE_INTEGER + 1;
      if (kind === "metric") data.metrics[0].name = "Sales";
      expect(() => normalizeLuminateStreams(data, request)).toThrow();
    },
  );
});
