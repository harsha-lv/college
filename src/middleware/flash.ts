import type { NextFunction, Request, Response } from "express";
import type { FlashType } from "../types/session";

export function flashMiddleware(req: Request, res: Response, next: NextFunction) {
  res.locals.flash = req.session.flash ?? [];
  delete req.session.flash;
  res.locals.currentStudent = req.user ?? null;
  res.locals.currentPath = req.path;
  next();
}

export function setFlash(req: Request, type: FlashType, message: string) {
  const messages = req.session.flash ?? [];
  messages.push({ type, message });
  req.session.flash = messages;
}
