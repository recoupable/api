import { recoupSkillFiles } from "./recoupSkillFiles";

/** Read a file selected from an authorized catalog manifest. */
export async function readRecoupSkillFile(uri: string) {
  const url = new URL(uri);
  return recoupSkillFiles.read(`${url.hostname}${decodeURIComponent(url.pathname)}`);
}
