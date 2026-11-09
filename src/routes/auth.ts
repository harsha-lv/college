import { Router } from "express";
import { env } from "../config/env";
import { passport } from "../auth/passport";
import { redirectIfAuthenticated } from "../middleware/auth";
import { setFlash } from "../middleware/flash";
import { safeNextPath } from "../utils/forms";

const router = Router();

router.get("/login", redirectIfAuthenticated, (req, res) => {
  res.render("login", {
    title: "Sign in",
    email: "",
    error: null,
    next: safeNextPath(req.query.next),
  });
});

router.post("/login", redirectIfAuthenticated, (req, res, next) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const nextPath = safeNextPath(req.body.next);

  if (!email || !password) {
    return res.render("login", {
      title: "Sign in",
      email,
      error: "Enter your email and password.",
      next: nextPath,
    });
  }

  passport.authenticate(
    "local",
    (error: unknown, user: Express.User | false, info: unknown) => {
      if (error) return next(error);

      if (!user) {
        const message =
          info && typeof info === "object" && "message" in info
            ? String((info as { message: unknown }).message)
            : "Invalid email or password.";

        return res.render("login", {
          title: "Sign in",
          email,
          error: message,
          next: nextPath,
        });
      }

      req.session.regenerate((regenerateError) => {
        if (regenerateError) return next(regenerateError);

        req.logIn(user, (loginError) => {
          if (loginError) return next(loginError);

          setFlash(req, "success", `Signed in as ${user.fullName}.`);
          return res.redirect(nextPath);
        });
      });
    },
  )(req, res, next);
});

router.post("/logout", (req, res, next) => {
  req.logout((logoutError) => {
    if (logoutError) return next(logoutError);

    req.session.destroy((destroyError) => {
      if (destroyError) return next(destroyError);

      res.clearCookie(env.SESSION_COOKIE_NAME, { path: "/" });
      return res.redirect("/login");
    });
  });
});

export default router;
