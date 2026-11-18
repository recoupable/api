export function literal(value: unknown): string {
  return value === null
    ? "NULL"
    : "'" +
        (typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''") +
        "'";
}
