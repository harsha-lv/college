import { createApp, disconnectDatabase } from "./app";
import { env } from "./config/env";
import { sessionPool } from "./session";

const app = createApp();

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`College course registration running at http://localhost:${env.PORT}`);
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\nReceived ${signal}. Shutting down...`);

  const forceExit = setTimeout(() => {
    console.error("Shutdown timed out.");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      await disconnectDatabase();
      await sessionPool.end();
      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
