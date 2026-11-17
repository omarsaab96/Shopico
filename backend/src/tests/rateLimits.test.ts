import express from "express";
import type { Server } from "node:http";
import { afterEach, expect, test } from "vitest";
import { createRateLimits } from "../middleware/rateLimits";

let server: Server | undefined;
afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(err => err ? reject(err) : resolve()));
});

test("browsing and authentication have separate limits and return retry information", async () => {
  const app = express();
  app.use(createRateLimits(2));
  app.use((_req, res) => res.json({ success: true }));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server!.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  const request = (path: string) => fetch(`http://127.0.0.1:${address.port}${path}`, { method: "POST" });

  expect((await request("/api/products")).status).toBe(200);
  expect((await request("/api/products")).status).toBe(200);
  expect((await request("/api/products")).status).toBe(429);
  expect((await request("/api/auth/password-status")).status).toBe(200);
  expect((await request("/api/auth/login")).status).toBe(200);
  const blocked = await request("/api/auth/password-status");
  expect(blocked.status).toBe(429);
  expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(blocked.headers.get("ratelimit-remaining")).toBe("0");
  expect(await blocked.json()).toEqual({ success: false, message: "Too many requests. Please try again later." });
});
