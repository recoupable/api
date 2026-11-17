export async function waitFor(test) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await test()) return;
    await new Promise(r => setTimeout(r, 25));
  }
  throw new Error("Offline fixture deadline exceeded");
}
