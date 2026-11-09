import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import {
  getDefaultAutoSelectFamilyAttemptTimeout,
  setDefaultAutoSelectFamilyAttemptTimeout,
} from "node:net";
import { env } from "./config/env";

const globalForSession = globalThis as unknown as {
  sessionPool?: Pool;
  sessionPoolAttached?: boolean;
};

// The Node default of 250ms can abandon healthy cross-region TCP connections.
// Preserve a longer timeout if the hosting environment already configured one.
setDefaultAutoSelectFamilyAttemptTimeout(
  Math.max(2_000, getDefaultAutoSelectFamilyAttemptTimeout()),
);

export const sessionPool =
  globalForSession.sessionPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    // Neon's pooled endpoint handles the real pooling. Keep the per-instance
    // pool small on Vercel so many function instances do not exhaust connections.
    max: process.env.VERCEL ? 1 : 10,
    connectionTimeoutMillis: 10_000,
  });

globalForSession.sessionPool = sessionPool;

if (process.env.VERCEL && !globalForSession.sessionPoolAttached) {
  attachDatabasePool(sessionPool);
  globalForSession.sessionPoolAttached = true;
}

const PgSession = connectPgSimple(session);

export function createSessionStore() {
  return new PgSession({
    pool: sessionPool,
    tableName: "session",
    // The session table is created by the Prisma migration.
    createTableIfMissing: false,
    pruneSessionInterval: 60 * 15,
  });
}
