/** Match Python str/repr for JSON values in canonical manual-workpaper diagnostics. */
export function pythonJsonText(value: unknown, nested = false): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") {
    if (!nested) return value;
    const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
    const escaped = Array.from(value, character => {
      if (character === "\\" || character === quote) return "\\" + character;
      if (character === "\n") return "\\n";
      if (character === "\r") return "\\r";
      if (character === "\t") return "\\t";
      // Python repr escapes non-printable categories, except the ordinary space.
      if (character !== " " && /[\p{Other}\p{Separator}]/u.test(character)) {
        const point = character.codePointAt(0)!;
        return point <= 0xff
          ? "\\x" + point.toString(16).padStart(2, "0")
          : point <= 0xffff
            ? "\\u" + point.toString(16).padStart(4, "0")
            : "\\U" + point.toString(16).padStart(8, "0");
      }
      return character;
    }).join("");
    return quote + escaped + quote;
  }
  if (Array.isArray(value)) return `[${value.map(item => pythonJsonText(item, true)).join(", ")}]`;
  if (typeof value === "object")
    return `{${Object.entries(value)
      .map(([key, item]) => `${pythonJsonText(key, true)}: ${pythonJsonText(item, true)}`)
      .join(", ")}}`;
  if (typeof value === "number") {
    // The oracle receives JSON: integer tokens become Python ints; exponent or
    // fractional tokens become floats. Python float repr switches at 1e-4/1e16.
    const json = JSON.stringify(value);
    if (!json.includes(".") && !json.includes("e")) return json;
    if (value !== 0 && (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e16)) {
      const [coefficient, exponent] = value.toExponential().split("e");
      const power = Number(exponent);
      return coefficient + "e" + (power < 0 ? "-" : "+") + String(Math.abs(power)).padStart(2, "0");
    }
    return String(value);
  }
  throw new Error("Expected a JSON diagnostic value");
}
