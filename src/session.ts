import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { env } from "./config/env";

export const sessionPool = new Pool({
  connectionString: env.DATABASE_URL,
});

const PgSession = connectPgSimple(session);

export function createSessionStore() {
  return new PgSession({
    pool: sessionPool,
    tableName: "session",
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 15,
  });
}
