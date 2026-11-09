import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { setFlash } from "./flash";
import { safeNextPath } from "../utils/forms";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function tokensMatch(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function safeReferer(req: Request) {
  const referer = req.get("referer");
  if (!referer) return "/";

  try {
    const url = new URL(referer);
    if (url.host === req.get("host")) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    // Fall through to the default path.
  }

  return "/";
}

export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  res.locals.csrfToken = req.session.csrfToken;

  if (SAFE_METHODS.has(req.method)) return next();

  const provided = typeof req.body?._csrf === "string" ? req.body._csrf : "";
  if (tokensMatch(provided, req.session.csrfToken)) return next();

  // Do not show a bare rejection page. Refresh the form instead so the
  // student can submit again with a valid token.
  if (req.path === "/login") {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    return res.render("login", {
      title: "Sign in",
      email,
      error: "Your sign-in session expired. Please try again.",
      next: safeNextPath(req.body?.next),
    });
  }

  setFlash(req, "error", "Your form session expired. Please try again.");
  return res.redirect(safeReferer(req));
}
