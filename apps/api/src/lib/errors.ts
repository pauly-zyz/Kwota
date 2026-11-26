export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const badRequest = (m: string, code = "invalid_request") => new HttpError(400, code, m);
export const unauthorized = (m = "unauthorized", code = "unauthorized") => new HttpError(401, code, m);
export const forbidden = (m = "forbidden", code = "forbidden") => new HttpError(403, code, m);
export const notFound = (m = "not found") => new HttpError(404, "not_found", m);
export const paymentRequired = (m = "insufficient kwota") => new HttpError(402, "insufficient_kwota", m);
export const tooMany = (m = "rate limit exceeded") => new HttpError(429, "rate_limited", m);
