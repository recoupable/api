/**
 * The model service answered with a non-OK status. Carries the upstream
 * status and body so the API can answer 502 with the real cause instead of
 * a generic 500, while keeping the documented message.
 */
export class FlamingoServiceError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`Music analysis failed (status ${status})`);
    this.name = "FlamingoServiceError";
    this.status = status;
    this.detail = detail;
  }
}
