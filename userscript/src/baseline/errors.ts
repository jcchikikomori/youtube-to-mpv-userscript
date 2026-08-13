export interface MpvHandlerErrorOptions {
  cause?: unknown;
}

/** Base class for every error this client throws once a request has actually been attempted. */
export abstract class MpvHandlerError extends Error {
  constructor(message: string, options?: MpvHandlerErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** No HTTP response was received at all — the handler process most likely isn't running. */
export class MpvHandlerUnreachableError extends MpvHandlerError {}

/** Our own client-side timeout fired before the handler responded. */
export class MpvHandlerTimeoutError extends MpvHandlerUnreachableError {}

/** The handler responded with a non-2xx HTTP status. */
export class MpvHandlerHttpError extends MpvHandlerError {
  readonly statusCode: number;
  readonly body: unknown;

  constructor(message: string, statusCode: number, body?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.body = body;
  }
}

/** The handler responded 2xx but the body failed JSON parsing or schema validation. */
export class MpvHandlerResponseError extends MpvHandlerError {}
