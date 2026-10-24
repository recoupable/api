/** Only an exact, unambiguous lifecycle opt-in changes disconnect behavior. */
export function usesExplicitChatStop(request: Pick<Request, "url">): boolean {
  const values = new URL(request.url).searchParams.getAll("streamLifecycle");
  return values.length === 1 && values[0] === "explicit-stop-v1";
}
