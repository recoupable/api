import { readFile } from "node:fs/promises";
import { join } from "node:path";
export async function readEvents(dir) {
  return (await readFile(join(dir, "events.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
}
