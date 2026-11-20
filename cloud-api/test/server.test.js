import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const secret = "test-only-session-secret-with-at-least-32-characters";
let directory;
let dbPath;
let port;
let child;
let baseUrl;
let adminIds = "";

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const selected = address.port;
  await new Promise(resolve => server.close(resolve));
  return selected;
}

async function startApi() {
  child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      SESSION_SECRET: secret,
      DB_PATH: dbPath,
      ADMIN_USER_IDS: adminIds,
      ALIBABA_CLOUD_ACCESS_KEY_ID: "",
      ALIBABA_CLOUD_ACCESS_KEY_SECRET: ""
    },
    stdio: "ignore"
  });

  baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API exited with code ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("API did not become ready within 10 seconds");
}

async function stopApi() {
  if (!child || child.exitCode !== null) return;
  const current = child;
  current.kill("SIGTERM");
  await new Promise(resolve => {
    const timeout = setTimeout(() => {
      current.kill("SIGKILL");
      resolve();
    }, 2000);
    current.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function request(route, { method = "GET", token, body } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, data: await response.json() };
}

test("account, session, admin and rental API flows", async t => {
  directory = await mkdtemp(path.join(os.tmpdir(), "lgh-cloudphone-"));
  dbPath = path.join(directory, "test.sqlite");
  port = await freePort();

  try {
    await startApi();

    await t.test("publishes plans and rejects weak registration", async () => {
      const plans = await request("/api/plans");
      assert.equal(plans.status, 200);
      assert.deepEqual(plans.data.plans.map(plan => plan.days), [1, 2, 3, 7, 30]);

      const weak = await request("/api/register", {
        method: "POST",
        body: { username: "testuser", password: "short" }
      });
      assert.equal(weak.status, 400);
    });

    let userId;
    let userToken;
    await t.test("registers, logs in and protects account routes", async () => {
      const created = await request("/api/register", {
        method: "POST",
        body: { username: "customer_1", password: "a-strong-test-password" }
      });
      assert.equal(created.status, 201);
      userId = created.data.id;

      const duplicate = await request("/api/register", {
        method: "POST",
        body: { username: "customer_1", password: "a-strong-test-password" }
      });
      assert.equal(duplicate.status, 409);

      const badLogin = await request("/api/login", {
        method: "POST",
        body: { username: "customer_1", password: "wrong-password" }
      });
      assert.equal(badLogin.status, 401);

      const login = await request("/api/login", {
        method: "POST",
        body: { username: "customer_1", password: "a-strong-test-password" }
      });
      assert.equal(login.status, 200);
      userToken = login.data.token;

      const me = await request("/api/me", { token: userToken });
      assert.equal(me.status, 200);
      assert.equal(me.data.user.id, userId);
      assert.equal(me.data.subscription, null);

      const protectedRoute = await request("/api/admin/overview", { token: userToken });
      assert.equal(protectedRoute.status, 403);
      const noToken = await request("/api/me");
      assert.equal(noToken.status, 401);
    });

    await t.test("blocks device sessions until a rental is active", async () => {
      const session = await request("/api/devices/session", {
        method: "POST",
        token: userToken
      });
      assert.equal(session.status, 402);
    });

    await t.test("admin allowlist grants a plan and exposes admin overview", async () => {
      await stopApi();
      adminIds = userId;
      await startApi();

      const login = await request("/api/login", {
        method: "POST",
        body: { username: "customer_1", password: "a-strong-test-password" }
      });
      assert.equal(login.status, 200);
      const adminToken = login.data.token;
      assert.equal(login.data.user.role, "admin");

      const overview = await request("/api/admin/overview", { token: adminToken });
      assert.equal(overview.status, 200);
      assert.equal(overview.data.users.length, 1);

      const grant = await request("/api/admin/grant-plan", {
        method: "POST",
        token: adminToken,
        body: { userId, days: 7 }
      });
      assert.equal(grant.status, 201);
      assert.equal(grant.data.days, 7);

      const me = await request("/api/me", { token: adminToken });
      assert.equal(me.data.subscription.status, "admin_free");
      assert.equal(me.data.subscription.unlimited, true);

      const missingProvider = await request("/api/admin/provider/status", { token: adminToken });
      assert.equal(missingProvider.status, 503);
    });

    await t.test("rejects invalid rental grants and unknown devices safely", async () => {
      const login = await request("/api/login", {
        method: "POST",
        body: { username: "customer_1", password: "a-strong-test-password" }
      });
      const token = login.data.token;

      const invalidPlan = await request("/api/admin/grant-plan", {
        method: "POST",
        token,
        body: { userId, days: 5 }
      });
      assert.equal(invalidPlan.status, 400);

      const invalidDevice = await request("/api/admin/assign-device", {
        method: "POST",
        token,
        body: { userId, instanceId: "not-an-instance" }
      });
      assert.equal(invalidDevice.status, 400);

      const noProvider = await request("/api/admin/assign-device", {
        method: "POST",
        token,
        body: { userId, instanceId: "acp-test-instance" }
      });
      assert.equal(noProvider.status, 503);
    });
  } finally {
    await stopApi();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});
