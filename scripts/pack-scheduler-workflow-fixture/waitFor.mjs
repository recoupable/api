export async function waitFor(test, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let timer;
    try {
      const expired = new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Offline fixture deadline exceeded")),
          Math.max(0, deadline - Date.now()),
        );
      });
      if (await Promise.race([Promise.resolve().then(test), expired])) return;
    } finally {
      clearTimeout(timer);
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error("Offline fixture deadline exceeded");
}
