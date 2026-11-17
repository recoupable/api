import { readFile } from "node:fs/promises";
export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}
