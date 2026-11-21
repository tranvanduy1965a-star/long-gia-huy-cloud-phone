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
  return { status: response.status, data: await response.json(), cacheControl: response.headers.get("cache-control") };
}

test("account, session, admin and rental API flows", async t => {
  directory = await mkdtemp(path.join(os.tmpdir(), "lgh-cloudphone-"));
  dbPath = path.join(directory, "test.sqlite");
  port = await freePort();

  try {
    await startApi();

    await t.test("returns safe JSON errors for malformed requests and unknown API routes", async () => {
      const malformed = await fetch(`${baseUrl}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{"
      });
      assert.equal(malformed.status, 400);
      assert.deepEqual(await malformed.json(), { error: "Dữ liệu gửi lên không hợp lệ." });

      const missing = await request("/api/does-not-exist");
      assert.equal(missing.status, 404);
      assert.deepEqual(missing.data, { error: "Không tìm thấy API này." });
    });

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

      const unknownLogin = await request("/api/login", {
        method: "POST",
        body: { username: "unknown_user", password: "wrong-password" }
      });
      assert.equal(unknownLogin.status, 401);
      assert.deepEqual(unknownLogin.data, badLogin.data);

      const login = await request("/api/login", {
        method: "POST",
        body: { username: "customer_1", password: "a-strong-test-password" }
      });
      assert.equal(login.status, 200);
      assert.match(login.cacheControl || "", /no-store/i);
      userToken = login.data.token;

      const me = await request("/api/me", { token: userToken });
      assert.equal(me.status, 200);
      assert.match(me.cacheControl || "", /no-store/i);
      assert.equal(me.data.user.id, userId);
      assert.equal(me.data.subscription, null);

      const protectedRoute = await request("/api/admin/overview", { token: userToken });
      assert.equal(protectedRoute.status, 403);
      const noToken = await request("/api/me");
      assert.equal(noToken.status, 401);
      const malformedToken = await fetch(`${baseUrl}/api/me`, { headers: { authorization: "Bearer a.b.c" } });
      assert.equal(malformedToken.status, 401);
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

      const renewal = await request("/api/admin/grant-plan", {
        method: "POST",
        token: adminToken,
        body: { userId, days: 3 }
      });
      assert.equal(renewal.status, 201);
      assert.ok(Date.parse(renewal.data.expiresAt) > Date.parse(grant.data.expiresAt));
      assert.ok(Date.parse(renewal.data.expiresAt) - Date.parse(grant.data.expiresAt) >= 3 * 86400000 - 1000);

      const auditedOverview = await request("/api/admin/overview", { token: adminToken });
      assert.equal(auditedOverview.status, 200);
      assert.equal(auditedOverview.data.auditLogs.length, 2);
      assert.equal(auditedOverview.data.auditLogs[0].action, "grant_plan");
      assert.equal(auditedOverview.data.auditLogs[0].target_user_id, userId);
      assert.equal(auditedOverview.data.auditLogs[0].details.days, 3);

      const me = await request("/api/me", { token: adminToken });
      assert.equal(me.data.subscription.status, "admin_free");
      assert.equal(me.data.subscription.unlimited, true);

      const missingProvider = await request("/api/admin/provider/status", { token: adminToken });
      assert.equal(missingProvider.status, 503);

      const missingCatalog = await request("/api/admin/provider/catalog", { token: adminToken });
      assert.equal(missingCatalog.status, 503);
      assert.equal(missingCatalog.data.configured, false);
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

      const deviceList = await request("/api/devices", { token });
      assert.equal(deviceList.status, 200);
      assert.deepEqual(deviceList.data.devices, []);
      assert.equal(deviceList.data.device, null);
      assert.match(deviceList.cacheControl || "", /no-store/i);

      // A requested device ID must belong to the signed-in user. This check
      // happens before provider credentials are needed, so it is testable
      // without provisioning a billable cloud instance.
      const foreignOrMissingDevice = await request("/api/devices/session", {
        method: "POST",
        token,
        body: { deviceId: "not-owned-device-id" }
      });
      assert.equal(foreignOrMissingDevice.status, 404);
      assert.match(foreignOrMissingDevice.data.error, /Không tìm thấy máy/);

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
