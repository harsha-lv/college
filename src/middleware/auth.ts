import type { NextFunction, Request, Response } from "express";
import { setFlash } from "./flash";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return next();

  setFlash(req, "error", "Please sign in to continue.");
  const nextPath = req.originalUrl;
  return res.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
}

export function redirectIfAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return res.redirect("/courses");
  return next();
}
