import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { prisma } from "../db";

let configured = false;

function toSessionUser(student: {
  id: string;
  fullName: string;
  email: string;
  studentNumber: string;
}): Express.User {
  return {
    id: student.id,
    fullName: student.fullName,
    email: student.email,
    studentNumber: student.studentNumber,
  };
}

export function configurePassport() {
  if (configured) return;
  configured = true;

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const student = await prisma.student.findUnique({
            where: { email: email.trim().toLowerCase() },
          });

          if (!student) {
            return done(null, false, { message: "Invalid email or password." });
          }

          const matches = await bcrypt.compare(password, student.passwordHash);
          if (!matches) {
            return done(null, false, { message: "Invalid email or password." });
          }

          return done(null, toSessionUser(student));
        } catch (error) {
          return done(error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const student = await prisma.student.findUnique({ where: { id } });
      if (!student) return done(null, false);
      return done(null, toSessionUser(student));
    } catch (error) {
      return done(error);
    }
  });
}

export { passport };
