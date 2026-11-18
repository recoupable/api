/** Request-local ownership for the inactive transport; closing is not storage cancellation. */
export function createProposedRegistrationMcpLifetime(request: Request) {
  let terminal: Response | undefined;
  let closing: Promise<void> | undefined;
  const cleanups: Array<() => Promise<unknown>> = [];
  let rejectStopped!: (reason: Response) => void;
  const stopped = new Promise<never>((_resolve, reject) => {
    rejectStopped = reject;
  });
  // Observe termination even if it occurs before the first stage starts.
  void stopped.catch(() => {});
  const stop = (status: number) => {
    if (terminal) return;
    terminal = Response.json(
      { error: "Request ended; an invoked storage outcome may be unknown" },
      { status },
    );
    rejectStopped(terminal);
  };
  const close = (): Promise<void> => {
    if (closing) return closing;
    stop(408);
    clearTimeout(deadline);
    request.signal.removeEventListener("abort", abort);
    closing = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const results = await Promise.race([
          Promise.allSettled(cleanups.map(cleanup => Promise.resolve().then(cleanup))),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error("Transport cleanup unconfirmed")), 1000);
          }),
        ]);
        if (results.some(result => result.status === "rejected"))
          throw new Error("Transport cleanup unconfirmed");
      } finally {
        clearTimeout(timer);
      }
    })();
    return closing;
  };
  const abort = () => {
    stop(408);
  };
  const deadline = setTimeout(() => {
    stop(504);
  }, 30000);
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  const assertActive = () => {
    if (terminal) throw terminal;
  };
  return {
    terminated: () => !!terminal || request.signal.aborted,
    assertActive,
    own(cleanup: () => Promise<unknown>) {
      if (closing) throw new Error("Request owner already closed");
      cleanups.push(cleanup);
    },
    async run<T>(work: () => Promise<T>): Promise<T> {
      assertActive();
      // Race installs rejection observers on losing work as well as termination.
      const result = await Promise.race([
        Promise.resolve().then(() => {
          assertActive();
          return work();
        }),
        stopped,
      ]);
      assertActive();
      return result;
    },
    close,
  };
}
