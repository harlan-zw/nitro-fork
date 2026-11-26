import type { H3Event, HTTPError, HTTPEvent } from "h3";
import type { NitroErrorHandler } from "nitro/types";

export function defineErrorHandler(handler: NitroErrorHandler): NitroErrorHandler {
  return handler;
}

/**
 * Create error response headers from `error.headers` (for handled errors)
 * merged with headers staged in `event.res.errHeaders` (cookies, CORS, ...).
 */
export function createErrorHeaders(
  error: HTTPError,
  event: HTTPEvent,
  unhandled?: boolean
): Headers {
  const headers = new Headers(unhandled ? {} : error.headers);
  const errHeaders = (event as H3Event).res?.errHeaders;
  if (errHeaders) {
    for (const [name, value] of errHeaders) {
      if (name === "set-cookie") {
        headers.append(name, value);
      } else {
        headers.set(name, value);
      }
    }
  }
  return headers;
}

const DOCUMENT_FETCH_DEST_RE = /^(?:document|iframe|frame|empty)$/i;

/**
 * Check whether the request expects an HTML error page rather than a JSON error response.
 * Subresource/asset `Sec-Fetch-Dest` values (`image`, `style`, `script`, `font`, ...) always
 * opt out of HTML even if `Accept` includes `text/html`.
 */
export function acceptsHTML(headers: Headers): boolean {
  const dest = headers.get("sec-fetch-dest");
  if (dest && !DOCUMENT_FETCH_DEST_RE.test(dest)) {
    return false;
  }
  return /\btext\/html\b/i.test(headers.get("accept") || "");
}

export type InternalHandlerResponse = {
  status?: number;
  statusText?: string | undefined;
  headers?: HeadersInit;
  body?: string | Record<string, any>;
};
