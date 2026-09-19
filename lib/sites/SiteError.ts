export class SiteError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
