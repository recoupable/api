import { contextToolOperations } from "./contextToolOperations";

/** Exclude dedicated names as well as the corresponding combined Context actions. */
export function isStandardOnlyContextTool(name: string) {
  return Object.values(contextToolOperations).some(
    metadata => "delegated" in metadata && metadata.delegated === false && metadata.name === name,
  );
}
