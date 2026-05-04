export function isStoppedSessionStatus(status: string | undefined): boolean {
  return (
    status === "stopped" ||
    status === "stopping" ||
    status === "snapshotting" ||
    status === "aborted" ||
    status === "failed"
  );
}
