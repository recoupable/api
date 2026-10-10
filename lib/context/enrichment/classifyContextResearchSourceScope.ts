import type { ContextResearchSourceScope } from "./artistResearchTypes";

function spans(tokens: string[], name: string[]): Array<[number, number]> {
  const found: Array<[number, number]> = [];
  if (!name.length) return found;
  for (let start = 0; start + name.length <= tokens.length; start += 1)
    if (name.every((word, offset) => tokens[start + offset] === word))
      found.push([start, start + name.length]);
  return found;
}

/**
 * Whole-name scope of one source from its word tokens. A focal mention counts unless it sits inside a
 * longer excluded name (the focal name inside a collaborator's name), so adjacent or repeated
 * collaborator mentions never read as focal evidence, and a shorter excluded name never erases a focal one.
 */
export function classifyContextResearchSourceScope(
  tokens: string[],
  focal: string[],
  excluded: string[][],
): ContextResearchSourceScope {
  const collaborators = excluded.flatMap(name => spans(tokens, name));
  const focalMention = spans(tokens, focal).some(
    ([start, end]) =>
      !collaborators.some(([from, to]) => from <= start && end <= to && to - from > end - start),
  );
  if (focalMention) return "focal_artist";
  return collaborators.length ? "collaborator_only" : "unattributed";
}
