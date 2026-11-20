import express from "express";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import path from "node:path";
import { describeCloudPhones, getConnectionTicket, providerConfigured } from "./provider.js";

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "32kb" }));
// Serve only the vendor SDK assets; never expose the repository or environment files.
app.use("/cloud-sdk", express.static(path.resolve(process.cwd(), "..", "cloud-sdk"), { dotfiles: "deny", index: false, fallthrough: true }));

const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER_IDS = new Set((process.env.ADMIN_USER_IDS || "").split(",").map(x => x.trim()).filter(Boolean));
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error("SESSION_SECRET must be set to a random value of at least 32 characters.");
  process.exit(1);
}

const db = new Database(process.env.DB_PATH || "./cloudphone.sqlite");
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, plan_days INTEGER NOT NULL,
  starts_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT NOT NULL,
  provider_instance_id TEXT, status TEXT NOT NULL DEFAULT 'not_provisioned',
  created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

const plans = [1, 2, 3, 7, 30];
const now = () => new Date().toISOString();
const sign = payload => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return body + "." + sig;
};
function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const [body, sig] = token.split(".");
  if (!body || !sig) return res.status(401).json({ error: "Cần đăng nhập." });
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest();
  let got;
  try { got = Buffer.from(sig, "base64url"); } catch { return res.status(401).json({ error: "Phiên không hợp lệ." }); }
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return res.status(401).json({ error: "Phiên không hợp lệ." });
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (p.exp < Date.now()) return res.status(401).json({ error: "Phiên đã hết hạn." });
    const user = db.prepare("SELECT id, username, role FROM users WHERE id=?").get(p.sub);
    if (!user) return res.status(401).json({ error: "Tài khoản không tồn tại." });
    req.user = user; next();
  } catch { return res.status(401).json({ error: "Phiên không hợp lệ." }); }
}
const isAdmin = user => user.role === "admin" || ADMIN_USER_IDS.has(user.id);
app.get("/", (_req,res) => res.sendFile(path.resolve(process.cwd(), "..", "index.html")));
app.get("/api/health", (_req,res) => res.json({ ok:true, service:"LONG GIA HUY Cloud Phone API", androidProviderConfigured:providerConfigured(), androidProviderConnected:false }));
app.get("/api/plans", (_req,res) => res.json({ plans: plans.map(days => ({ days, label: days + " ngày" })) }));

app.post("/api/register", async (req,res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!/^[a-z0-9_]{4,24}$/.test(username) || password.length < 10)
    return res.status(400).json({ error: "Tên tài khoản 4–24 ký tự (a-z, 0-9, _); mật khẩu tối thiểu 10 ký tự." });
  const id = crypto.randomUUID();
  try {
    const hash = await bcrypt.hash(password, 12);
    db.prepare("INSERT INTO users(id,username,password_hash,created_at) VALUES(?,?,?,?)").run(id, username, hash, now());
    res.status(201).json({ id, username, message: "Đăng ký thành công. Tài khoản cần được cấp gói thuê trước khi tạo máy." });
  } catch { res.status(409).json({ error: "Tên tài khoản đã được sử dụng." }); }
});
app.post("/api/login", async (req,res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu." });
  const admin = isAdmin(user);
  const token = sign({ sub:user.id, exp:Date.now() + 7*24*60*60*1000 });
  res.json({ token, user:{ id:user.id, username:user.username, role:admin ? "admin" : "user" } });
});
app.get("/api/me", auth, (req,res) => {
  const admin = isAdmin(req.user);
  const sub = db.prepare("SELECT plan_days,starts_at,expires_at,status FROM subscriptions WHERE user_id=? ORDER BY expires_at DESC LIMIT 1").get(req.user.id);
  res.json({ user:{ id:req.user.id, username:req.user.username, role:admin ? "admin" : "user" }, subscription: admin ? { status:"admin_free", unlimited:true } : (sub || null) });
});

// Read-only provider check. Never returns credentials and never provisions billable resources.
app.get("/api/admin/provider/status", auth, async (req,res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error:"Chỉ admin." });
  if (!providerConfigured()) return res.status(503).json({ configured:false, connected:false, message:"Chưa cấu hình AccessKey ở phần biến môi trường bảo mật của máy chủ." });
  try {
    const result = await describeCloudPhones();
    res.json({ configured:true, ...result });
  } catch (error) {
    console.error("Alibaba Cloud provider check failed:", error?.code || error?.name || "unknown");
    res.status(502).json({ configured:true, connected:false, message:"Không kết nối được Alibaba Cloud. Kiểm tra quyền RAM, region và endpoint trong cấu hình máy chủ." });
  }
});

// This endpoint is intentionally admin-only and manual until a verified payment webhook is configured.
app.post("/api/admin/grant-plan", auth, (req,res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error:"Chỉ admin mới được cấp gói." });
  const userId = String(req.body?.userId || "");
  const days = Number(req.body?.days);
  if (!plans.includes(days)) return res.status(400).json({ error:"Gói không hợp lệ." });
  const user = db.prepare("SELECT id FROM users WHERE id=?").get(userId);
  if (!user) return res.status(404).json({ error:"Không tìm thấy người dùng." });
  const id = crypto.randomUUID(), start = new Date(), end = new Date(start.getTime() + days*86400000);
  db.prepare("INSERT INTO subscriptions(id,user_id,plan_days,starts_at,expires_at,status) VALUES(?,?,?,?,?,?)")
    .run(id,userId,days,start.toISOString(),end.toISOString(),"active");
  res.status(201).json({ id, userId, days, expiresAt:end.toISOString() });
});

app.get("/api/devices", auth, (req,res) => {
  const device = db.prepare("SELECT id,provider,provider_instance_id,status,created_at FROM devices WHERE user_id=? ORDER BY created_at DESC LIMIT 1").get(req.user.id);
  res.json({ device: device || null });
});

// Admin assigns an already-purchased instance; this does not create billable resources.
app.post("/api/admin/assign-device", auth, (req,res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error:"Chỉ admin." });
  const userId = String(req.body?.userId || "");
  const instanceId = String(req.body?.instanceId || "").trim();
  if (!userId || !/^acp-[a-zA-Z0-9-]+$/.test(instanceId)) return res.status(400).json({ error:"Cần userId hợp lệ và instanceId dạng acp-..." });
  if (!db.prepare("SELECT id FROM users WHERE id=?").get(userId)) return res.status(404).json({ error:"Không tìm thấy người dùng." });
  const occupied = db.prepare("SELECT user_id FROM devices WHERE provider_instance_id=? AND user_id<>?").get(instanceId,userId);
  if (occupied) return res.status(409).json({ error:"Máy này đang được gán cho tài khoản khác." });
  const existing = db.prepare("SELECT id FROM devices WHERE user_id=? ORDER BY created_at DESC LIMIT 1").get(userId);
  if (existing) { db.prepare("UPDATE devices SET provider=?,provider_instance_id=?,status=? WHERE id=?").run("alibaba-cloud",instanceId,"assigned",existing.id); return res.json({ assigned:true,userId,instanceId }); }
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO devices(id,user_id,provider,provider_instance_id,status,created_at) VALUES(?,?,?,?,?,?)").run(id,userId,"alibaba-cloud",instanceId,"assigned",now());
  res.status(201).json({ assigned:true,userId,instanceId });
});

app.post("/api/devices/session", auth, async (req,res) => {
  const admin = isAdmin(req.user);
  const sub = db.prepare("SELECT expires_at FROM subscriptions WHERE user_id=? AND status='active' ORDER BY expires_at DESC LIMIT 1").get(req.user.id);
  if (!admin && (!sub || Date.parse(sub.expires_at) <= Date.now())) return res.status(402).json({ error:"Gói thuê đã hết hạn hoặc chưa được kích hoạt." });
  const device = db.prepare("SELECT provider_instance_id FROM devices WHERE user_id=? ORDER BY created_at DESC LIMIT 1").get(req.user.id);
  if (!device?.provider_instance_id) return res.status(404).json({ error:"Tài khoản chưa được gán máy Android Cloud." });
  if (!providerConfigured()) return res.status(503).json({ error:"Máy chủ chưa cấu hình Alibaba Cloud.", code:"PROVIDER_NOT_CONFIGURED" });
  try {
    const ticket = await getConnectionTicket(device.provider_instance_id, req.user.id);
    res.json({ provider:"alibaba-cloud",region:process.env.ALIBABA_CLOUD_REGION || "ap-southeast-1", ...ticket });
  } catch (error) {
    console.error("Cloud phone ticket request failed:", error?.code || error?.name || "unknown");
    res.status(502).json({ error:"Chưa lấy được phiên điều khiển. Kiểm tra máy đã chạy và chế độ đăng nhập không cần ủy quyền đã được bật.", code:"CONNECTION_TICKET_FAILED" });
  }
});

app.get("/api/admin/overview", auth, (req,res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error:"Chỉ admin." });
  const users = db.prepare("SELECT id,username,created_at FROM users ORDER BY created_at DESC").all();
  const subscriptions = db.prepare("SELECT user_id,plan_days,expires_at,status FROM subscriptions ORDER BY expires_at DESC").all();
  res.json({ users, subscriptions, deviceProviderConfigured:providerConfigured() });
});

app.listen(PORT, () => console.log(`LONG GIA HUY API listening on :${PORT}`));
