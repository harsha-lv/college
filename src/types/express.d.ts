import type { FlashMessage, RegistrationDraft } from "./session";

declare global {
  namespace Express {
    interface User {
      id: string;
      fullName: string;
      email: string;
      studentNumber: string;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    flash?: FlashMessage[];
    registrationDraft?: RegistrationDraft;
    csrfToken?: string;
  }
}

export {};
