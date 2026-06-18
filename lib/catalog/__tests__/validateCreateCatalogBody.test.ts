import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";

import { validateCreateCatalogBody } from "../validateCreateCatalogBody";

const snapshotId = "550e8400-e29b-41d4-a716-446655440000";

describe("validateCreateCatalogBody", () => {
  it("accepts a name-only body", () => {
    const result = validateCreateCatalogBody({ name: "My Catalog" });
    expect(result).toEqual({ name: "My Catalog" });
  });

  it("accepts a from-only body and parses snapshot_id", () => {
    const result = validateCreateCatalogBody({ from: { snapshot_id: snapshotId } });
    expect(result).toEqual({ from: { snapshot_id: snapshotId } });
  });

  it("accepts name and from together", () => {
    const result = validateCreateCatalogBody({
      name: "Bad Bunny — Catalog",
      from: { snapshot_id: snapshotId },
    });
    expect(result).toEqual({
      name: "Bad Bunny — Catalog",
      from: { snapshot_id: snapshotId },
    });
  });

  it("rejects an empty body (neither name nor from) with 400", async () => {
    const result = validateCreateCatalogBody({});
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("error");
  });

  it("rejects a non-uuid snapshot_id with 400", async () => {
    const result = validateCreateCatalogBody({ from: { snapshot_id: "not-a-uuid" } });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("rejects a null/non-object body with 400", async () => {
    const result = validateCreateCatalogBody(null);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
