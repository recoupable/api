import Decimal from "decimal.js";
import type { IngestionContract } from "./types";

/** Convert only according to the declared contract; identifiers remain strings. */
export function normalizeIngestionValue(
  value: string | null,
  field: IngestionContract["fields"][number],
): string | null {
  const text = value === null ? null : field.trim ? value.trim() : value;
  if (text === null || text === "") {
    if (field.nullable) return null;
    throw new Error("VALUE_REQUIRED");
  }
  if (field.type === "string") return text;
  if (field.type === "boolean") {
    if (!["true", "false"].includes(text)) throw new Error("VALUE_INVALID");
    return text;
  }
  if (field.type === "date") {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
      !Number.isFinite(Date.parse(text)) ||
      new Date(text).toISOString().slice(0, 10) !== text
    )
      throw new Error("VALUE_INVALID");
    return text;
  }
  let number = text;
  if (field.thousands_separator) {
    const [whole, ...fraction] = number.split(field.decimal_separator);
    const escaped = field.thousands_separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (
      whole.includes(field.thousands_separator) &&
      !new RegExp(`^[+-]?\\d{1,3}(?:${escaped}\\d{3})+$`).test(whole)
    )
      throw new Error("VALUE_INVALID");
    number = [whole.split(field.thousands_separator).join(""), ...fraction].join(
      field.decimal_separator,
    );
  }
  if (field.decimal_separator !== ".") number = number.replace(field.decimal_separator, ".");
  if (
    !/^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d{1,2})?$/.test(number) ||
    number.replace(/\D/g, "").length > 60
  )
    throw new Error("VALUE_INVALID");
  const parsed = new Decimal(number);
  if (
    !parsed.isFinite() ||
    Math.abs(parsed.e) > 60 ||
    parsed.decimalPlaces() > 60 ||
    (field.type === "integer" && !parsed.isInteger())
  )
    throw new Error("VALUE_INVALID");
  return parsed.toFixed();
}
