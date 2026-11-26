import { HTTPError, mockEvent } from "h3";
import { describe, expect, it } from "vitest";
import { defaultHandler } from "../../src/runtime/internal/error/dev.ts";
import { acceptsHTML } from "../../src/runtime/internal/error/utils.ts";

describe("acceptsHTML", () => {
  it("returns true for browser navigation and explicit text/html requests", () => {
    expect(
      acceptsHTML(
        new Headers({
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "sec-fetch-dest": "document",
        })
      )
    ).toBe(true);
    expect(acceptsHTML(new Headers({ accept: "text/html", "sec-fetch-dest": "iframe" }))).toBe(
      true
    );
    expect(acceptsHTML(new Headers({ accept: "text/html", "sec-fetch-dest": "frame" }))).toBe(true);
    expect(acceptsHTML(new Headers({ accept: "text/html", "sec-fetch-dest": "empty" }))).toBe(true);
    expect(acceptsHTML(new Headers({ accept: "text/html" }))).toBe(true);
    expect(acceptsHTML(new Headers({ accept: "TEXT/HTML" }))).toBe(true);
  });

  it("returns false for non-HTML Accept headers", () => {
    for (const accept of [
      "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "image/*",
      "text/css,*/*;q=0.1",
      "font/woff2",
      "audio/*",
      "video/*",
      "application/json",
      "*/*",
      "",
    ]) {
      expect(acceptsHTML(new Headers(accept ? { accept } : {})), accept || "(empty)").toBe(false);
    }
  });

  it("returns false for non-document Sec-Fetch-Dest even when Accept includes text/html", () => {
    for (const dest of [
      "image",
      "style",
      "script",
      "font",
      "audio",
      "video",
      "worker",
      "manifest",
    ]) {
      expect(
        acceptsHTML(new Headers({ accept: "text/html,*/*", "sec-fetch-dest": dest })),
        dest
      ).toBe(false);
    }
  });
});

describe("dev error defaultHandler", () => {
  const notFound = () => new HTTPError({ status: 404, statusText: "Not Found" });

  it("returns JSON for non-HTML Accept headers and subresource Sec-Fetch-Dest", async () => {
    for (const headers of [
      { accept: "image/*" },
      { accept: "text/css,*/*;q=0.1" },
      { accept: "font/woff2" },
      { accept: "*/*" },
      {},
      { accept: "text/html,*/*", "sec-fetch-dest": "image" },
      { accept: "text/html,*/*", "sec-fetch-dest": "style" },
      { accept: "text/html,*/*", "sec-fetch-dest": "script" },
      { accept: "text/html,*/*", "sec-fetch-dest": "font" },
    ] as Record<string, string>[]) {
      const event = mockEvent("/missing.png", { headers });
      const res = await defaultHandler(notFound(), event, { silent: true });
      expect(res.status).toBe(404);
      expect(new Headers(res.headers).get("content-type")).toBe("application/json; charset=utf-8");
      expect(res.body).toMatchObject({ error: true, status: 404 });
    }
  });

  it("returns HTML for browser document requests and explicit fetch text/html requests", async () => {
    for (const headers of [
      { accept: "text/html", "sec-fetch-dest": "document" },
      { accept: "text/html", "sec-fetch-dest": "empty" },
      { accept: "text/html" },
    ] as Record<string, string>[]) {
      const event = mockEvent("/missing-page", { headers });
      const res = await defaultHandler(notFound(), event, { silent: true });
      expect(res.status).toBe(404);
      expect(new Headers(res.headers).get("content-type")).toBe("text/html; charset=utf-8");
      expect(typeof res.body).toBe("string");
      expect(res.body).toContain("<!DOCTYPE html>");
    }
  });

  it("respects explicit opts.json overrides", async () => {
    const htmlEvent = mockEvent("/missing", {
      headers: { accept: "text/html", "sec-fetch-dest": "document" },
    });
    const forcedJSON = await defaultHandler(notFound(), htmlEvent, { silent: true, json: true });
    expect(new Headers(forcedJSON.headers).get("content-type")).toBe(
      "application/json; charset=utf-8"
    );

    const jsonEvent = mockEvent("/missing", { headers: { accept: "image/*" } });
    const forcedHTML = await defaultHandler(notFound(), jsonEvent, { silent: true, json: false });
    expect(new Headers(forcedHTML.headers).get("content-type")).toBe("text/html; charset=utf-8");
  });
});
