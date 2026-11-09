import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import helmet from "helmet";
import { configurePassport, passport } from "./auth/passport";
import { env } from "./config/env";
import { prisma } from "./db";
import { csrfMiddleware } from "./middleware/csrf";
import { flashMiddleware } from "./middleware/flash";
import authRoutes from "./routes/auth";
import courseRoutes from "./routes/courses";
import registrationRoutes from "./routes/registration";
import registrationsRoutes from "./routes/registrations";
import { createSessionStore } from "./session";

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function createApp() {
  const app = express();
  const projectRoot = path.resolve(__dirname, "..");

  app.set("view engine", "ejs");
  app.set("views", path.join(projectRoot, "views"));
  app.set("trust proxy", env.NODE_ENV === "production" ? 1 : 0);

  app.locals.appName = "College Course Registration";
  app.locals.showDemo = env.NODE_ENV !== "production";
  app.locals.formatDate = formatDate;
  app.locals.formatDateTime = formatDateTime;

  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
      strictTransportSecurity: env.NODE_ENV === "production" ? undefined : false,
    }),
  );
  app.use(express.urlencoded({ extended: false }));
  app.use(
    express.static(path.join(projectRoot, "public"), {
      maxAge: env.NODE_ENV === "production" ? "1d" : 0,
    }),
  );

  app.use(
    session({
      store: createSessionStore(),
      name: "college.sid",
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flashMiddleware);
  app.use(csrfMiddleware);

  app.get("/", (req, res) => {
    return res.redirect(req.isAuthenticated() ? "/courses" : "/login");
  });

  app.use(authRoutes);
  app.use(courseRoutes);
  app.use(registrationRoutes);
  app.use(registrationsRoutes);

  app.use((req: Request, res: Response) => {
    res.status(404).render("404", {
      title: "Page not found",
      message: "The page you requested does not exist.",
    });
  });

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);

    console.error(error);

    res.locals.currentStudent ??= req.user ?? null;
    res.locals.currentPath ??= req.path;
    res.locals.flash ??= [];
    res.locals.csrfToken ??= "";

    return res.status(500).render("error", {
      title: "Something went wrong",
      message:
        env.NODE_ENV === "production"
          ? "An unexpected error occurred. Please try again."
          : error instanceof Error
            ? error.message
            : String(error),
    });
  });

  return app;
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
