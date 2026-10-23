// BARAZANI Online — backend serveur (Express + WebSocket + JSON store)
// Usage: npm install & node server.js  (port 10000 par défaut)
import express from 'express';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'mon_amour_et_mon_coeur_grace_mihigo';
const PORT = Number(process.env.PORT) || 10000;

function resolveDataFile() {
  const candidates = [
    process.env.DATA_FILE,
    process.env.DATA_PATH,
    path.join(process.cwd(), 'data.json'),
    path.join('/tmp', 'barazani-backend', 'data.json'),
    path.join(os.tmpdir(), 'barazani-backend', 'data.json')
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const dir = path.dirname(candidate);
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return candidate;
    } catch {
      // Fall through to the next candidate.
    }
  }

  return path.join('/tmp', 'barazani-backend', 'data.json');
}

const DATA_FILE = resolveDataFile();

let db = { users: [], friends: [], messages: [], nextId: 1 };

function load() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      save();
      return;
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) {
      save();
      return;
    }

    const parsed = JSON.parse(raw);
    db = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      nextId: Number(parsed.nextId) || 1
    };
  } catch (err) {
    console.warn('Could not read data store, resetting to empty state:', err.message);
    db = { users: [], friends: [], messages: [], nextId: 1 };
    save();
  }
}

function save() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.warn(`Warning: could not persist data to ${DATA_FILE}: ${err.message}`);
  }
}

load();
setInterval(save, 5000);
const uid = () => 'u' + (db.nextId++);

const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/hello', (req, res) => {
  res.json({ message: '✅ BARAZANI Server is running!', time: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    name: 'BARAZANI Online API',
    status: '✅ running',
    version: '1.0.0'
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const sockets = new Map();

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'non authentifié' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'session expirée' }); }
}

const pubUser = (u) => ({ id: u.id, username: u.username, name: u.name, bio: u.bio || '', avatar: u.avatar || '', createdAt: u.createdAt });

app.post('/api/register', async (req, res) => {
  const { username, name, password } = req.body || {};
  if (!username || !name || !password || password.length < 4) return res.status(400).json({ error: 'champs invalides (mot de passe ≥ 4 caractères)' });
  if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: "nom d'utilisateur déjà pris" });
  const user = { id: uid(), username, name, passwordHash: await bcrypt.hash(password, 10), bio: '', avatar: '', createdAt: Date.now() };
  db.users.push(user); save();
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '365d' });
  res.json({ token, user: pubUser(user) });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = db.users.find(u => u.username.toLowerCase() === String(username || '').toLowerCase());
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ error: 'identifiants incorrects' });
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '365d' });
  res.json({ token, user: pubUser(user) });
});

app.get('/api/me', auth, (req, res) => {
  const u = db.users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'compte introuvable' });
  res.json(pubUser(u));
});

app.put('/api/me', auth, (req, res) => {
  const u = db.users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'compte introuvable' });
  const { name, bio, avatar, password } = req.body || {};
  if (name) u.name = String(name).slice(0, 50);
  if (bio !== undefined) u.bio = String(bio).slice(0, 200);
  if (avatar !== undefined) u.avatar = String(avatar).slice(0, 500000);
  if (password && String(password).length >= 4) u.passwordHash = bcrypt.hashSync(String(password), 10);
  save();
  res.json(pubUser(u));
});

app.delete('/api/me', auth, (req, res) => {
  const id = req.user.id;
  db.users = db.users.filter(u => u.id !== id);
  db.friends = db.friends.filter(f => f.a !== id && f.b !== id);
  db.messages = db.messages.filter(m => m.from !== id && m.to !== id);
  save();
  const ws = sockets.get(id); if (ws) try { ws.close(); } catch {}
  res.json({ ok: true });
});

app.get('/api/users/search', auth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json([]);
  const results = db.users
    .filter(u => u.id !== req.user.id && (u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)))
    .slice(0, 20)
    .map(pubUser);
  res.json(results);
});

function friendRow(a, b) { return db.friends.find(f => (f.a === a && f.b === b) || (f.a === b && f.b === a)); }

app.get('/api/friends', auth, (req, res) => {
  const id = req.user.id;
  const list = db.friends
    .filter(f => (f.a === id || f.b === id) && f.status === 'accepted')
    .map(f => {
      const fid = f.a === id ? f.b : f.a;
      const u = db.users.find(x => x.id === fid);
      return u ? pubUser(u) : null;
    }).filter(Boolean);
  res.json(list);
});

app.get('/api/friends/requests', auth, (req, res) => {
  const id = req.user.id;
  const reqs = db.friends.filter(f => f.b === id && f.status === 'pending').map(f => {
    const u = db.users.find(x => x.id === f.a);
    return u ? pubUser(u) : null;
  }).filter(Boolean);
  res.json(reqs);
});

app.post('/api/friends/request', auth, (req, res) => {
  const { userId } = req.body || {};
  const me = req.user.id;
  if (!userId || userId === me) return res.status(400).json({ error: 'invalide' });
  if (!db.users.find(u => u.id === userId)) return res.status(404).json({ error: 'utilisateur introuvable' });
  if (friendRow(me, userId)) return res.status(409).json({ error: 'déjà ami ou demande en cours' });
  db.friends.push({ a: me, b: userId, status: 'pending' });
  save();
  sendTo(userId, { type: 'friend-request', from: pubUser(db.users.find(u => u.id === me)) });
  res.json({ ok: true });
});

app.post('/api/friends/accept', auth, (req, res) => {
  const { userId } = req.body || {};
  const row = friendRow(req.user.id, userId);
  if (!row || row.status !== 'pending') return res.status(404).json({ error: 'demande introuvable' });
  row.status = 'accepted'; save();
  sendTo(userId, { type: 'friend-accepted', from: pubUser(db.users.find(u => u.id === req.user.id)) });
  res.json({ ok: true });
});

app.post('/api/friends/remove', auth, (req, res) => {
  const { userId } = req.body || {};
  db.friends = db.friends.filter(f => !((f.a === req.user.id && f.b === userId) || (f.a === userId && f.b === req.user.id)));
  save();
  res.json({ ok: true });
});

app.get('/api/messages/:friendId', auth, (req, res) => {
  const me = req.user.id, fid = req.params.friendId;
  const row = friendRow(me, fid);
  if (!row || row.status !== 'accepted') return res.status(403).json({ error: 'pas ami' });
  const msgs = db.messages.filter(m => (m.from === me && m.to === fid) || (m.from === fid && m.to === me)).slice(-100);
  res.json(msgs);
});

app.post('/api/messages', auth, (req, res) => {
  const me = req.user.id;
  const { toUserId, type, text, audio, image } = req.body || {};
  const row = friendRow(me, toUserId);
  if (!row || row.status !== 'accepted') return res.status(403).json({ error: 'pas ami' });
  const msg = {
    id: 'm' + (db.nextId++),
    from: me,
    to: toUserId,
    type: type || 'text',
    text: text ? String(text).slice(0, 2000) : '',
    audio: audio ? String(audio).slice(0, 500000) : '',
    image: image ? String(image).slice(0, 500000) : ''
  };
  db.messages.push(msg); save();
  sendTo(toUserId, { type: 'message', message: msg });
  res.json(msg);
});

function sendTo(userId, obj) {
  const ws = sockets.get(userId);
  if (ws && ws.readyState === 1) try { ws.send(JSON.stringify(obj)); } catch {}
}

wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://x').searchParams.get('token');
  let user;
  try { user = jwt.verify(token, JWT_SECRET); } catch { ws.close(); return; }
  sockets.set(user.id, ws);
  ws.on('close', () => { if (sockets.get(user.id) === ws) sockets.delete(user.id); });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ BARAZANI Online — listening on port ${PORT}`);
  console.log(`Data store: ${DATA_FILE}`);
});
