const { randomBytes } = require("node:crypto");
const { userInfo } = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Pool } = require("pg");

const projectRoot = path.resolve(__dirname, "..");
const databaseName = "college_registration_demo";

function createDemoEnv(inherited = process.env) {
  // Deliberately do not read .env: it contains the Neon production connection.
  const url = new URL("postgresql://127.0.0.1:55432/" + databaseName);
  url.username = userInfo().username;
  url.searchParams.set("schema", "public");
  return {
    ...inherited,
    DATABASE_URL: url.toString(),
    DATABASE_URL_UNPOOLED: url.toString(),
    DIRECT_URL: url.toString(),
    SESSION_SECRET: randomBytes(32).toString("hex"),
    SESSION_COOKIE_NAME: "college.demo.sid",
    NODE_ENV: "development",
    HOST: "127.0.0.1",
    PORT: "3002",
    VERCEL: "",
  };
}

function run(script, env) {
  const result = spawnSync("npm", ["run", script], {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed (${result.signal || result.status}).`);
}

async function main() {
  const mode = process.argv[2];
  if (!["setup", "start", "studio"].includes(mode)) {
    throw new Error("Use npm run demo:setup, npm run demo, or npm run demo:studio.");
  }
  const env = createDemoEnv();
  console.log("Local demo only: 127.0.0.1:55432 / " + databaseName);

  if (mode === "setup") {
    const pool = new Pool({
      host: "127.0.0.1",
      port: 55432,
      user: userInfo().username,
      password: "",
      database: "postgres",
      connectionTimeoutMillis: 3_000,
    });
    try {
      const existing = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
      if (existing.rowCount === 0) {
        // The identifier is a fixed constant, never user input.
        await pool.query('CREATE DATABASE "college_registration_demo"');
      }
    } catch (error) {
      throw new Error(`Local PostgreSQL setup failed: ${error.message}. Start the project cluster on port 55432 first.`);
    } finally {
      await pool.end();
    }
    run("db:deploy", env);
    run("db:seed", env);
    console.log("Demo ready. Run npm run demo, then open http://localhost:3002.");
  } else {
    if (mode === "start") {
      console.log("Session cookies are isolated; restarting the demo requires signing in again.");
    }
    run(mode === "start" ? "dev" : "db:studio", env);
  }
}

module.exports = { createDemoEnv };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
