import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const requireApp = createRequire(path.join(process.cwd(), "package.json"));
const { createDemoEnv } = requireApp("./scripts/demo.cjs");

describe("local demo environment", () => {
  it("overrides inherited cloud URLs with the dedicated local database", () => {
    const inherited = {
      DATABASE_URL: "postgresql://cloud.example/production",
      DATABASE_URL_UNPOOLED: "postgresql://cloud.example/production",
      DIRECT_URL: "postgresql://cloud.example/production",
      NODE_ENV: "production",
      VERCEL: "1",
    };
    const env = createDemoEnv(inherited);
    const url = new URL(env.DATABASE_URL);
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.port).toBe("55432");
    expect(url.pathname).toBe("/college_registration_demo");
    expect(env.DATABASE_URL_UNPOOLED).toBe(env.DATABASE_URL);
    expect(env.DIRECT_URL).toBe(env.DATABASE_URL);
    expect(inherited.NODE_ENV).toBe("production");
    expect(env.VERCEL).toBe("");
  });

  it("isolates demo sessions and binds to loopback", () => {
    const env = createDemoEnv({});
    expect(env.SESSION_COOKIE_NAME).toBe("college.demo.sid");
    expect(env.HOST).toBe("127.0.0.1");
    expect(env.PORT).toBe("3002");
    expect(env.NODE_ENV).toBe("development");
    expect(env.SESSION_SECRET).toMatch(/^[a-f0-9]{64}$/);
    expect(createDemoEnv({}).SESSION_SECRET).not.toBe(env.SESSION_SECRET);
  });
});
