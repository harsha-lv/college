import type { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function originCheck(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  if (!origin) return next();

  try {
    const originUrl = new URL(origin);
    if (originUrl.host === req.get("host")) return next();
  } catch {
    // Fall through to the rejection below.
  }

  return res.status(403).render("error", {
    title: "Request rejected",
    message: "This request did not come from the registration site.",
  });
}
