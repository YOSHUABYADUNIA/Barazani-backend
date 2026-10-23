// BARAZANI Online — backend serveur (Express + WebSocket + JSON store)
// Usage: npm install && node server.js  (port 10000 par défaut)
import express from 'express';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'mon_amour_et_mon_coeur_grace_mihigo';
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

// ---------- Stockage persistant (JSON) ----------
let db = { users: [], friends: [], messages: [], posts: [], nextId: 1 };

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (raw.trim()) {
      const parsed = JSON.parse(raw);
      db = {
        users: parsed.users || [],
        friends: parsed.friends || [],
        messages: parsed.messages || [],
        posts: parsed.posts || [],
        nextId: parsed.nextId || 1
      };
    }
  } catch {
    // Ignore if the file does not exist yet
  }

  db.users = (db.users || []).map(u => {
    const name = String(u.username || '').trim().toLowerCase();
    const isAdmin = u.role === 'admin' || ADMIN_USERNAMES.includes(name);
    return { ...u, role: isAdmin ? 'admin' : (u.role || 'user') };
  });
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Erreur d'écriture du store JSON:", err);
  }
}

load();
setInterval(save, 5000);
const uid = () => 'u' + (db.nextId++);

const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route de test
app.get('/api/hello', (req, res) => {
  res.json({ message: '✅ BARAZANI Server is running!', time: new Date().toISOString() });
});

// Réponse pour la racine API
app.get('/api', (req, res) => {
  res.json({
    name: 'BARAZANI Online API',
    status: '✅ running',
    version: '1.0.0'
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const sockets = new Map(); // userId -> ws

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'non authentifié' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'session expirée' }); }
}

function ensureUserRole(u) {
  if (!u) return u;
  const username = String(u.username || '').trim().toLowerCase();
  u.role = ADMIN_USERNAMES.includes(username) ? 'admin' : (u.role || 'user');
  return u;
}

function isAdminUser(u) {
  if (!u) return false;
  const username = String(u.username || '').trim().toLowerCase();
  return u.role === 'admin' || ADMIN_USERNAMES.includes(username);
}

function requireAdmin(req, res, next) {
  const user = db.users.find(x => x.id === req.user.id);
  if (!user || !isAdminUser(ensureUserRole(user))) {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  next();
}

const pubUser = (u) => {
  if (!u) return null;
  const safe = ensureUserRole(u);
  return {
    id: safe.id,
    username: safe.username,
    name: safe.name,
    bio: safe.bio || '',
    avatar: safe.avatar || '',
    role: isAdminUser(safe) ? 'admin' : 'user',
    createdAt: safe.createdAt
  };
};

const serializePost = (post) => {
  const author = db.users.find(u => u.id === post.userId) || null;
  return {
    id: post.id,
    userId: post.userId,
    text: post.text || '',
    image: post.image || '',
    visibility: post.visibility || 'public',
    createdAt: post.createdAt || Date.now(),
    author: author ? pubUser(author) : { id: 'deleted', username: 'deleted', name: 'Utilisateur supprimé', bio: '', avatar: '', role: 'user', createdAt: null }
  };
};

// ---------- Auth ----------
app.post('/api/register', async (req, res) => {
  const { username, name, password } = req.body || {};
  if (!username || !name || !password || password.length < 4) return res.status(400).json({ error: 'champs invalides (mot de passe ≥ 4 caractères)' });
  const normalized = String(username).trim();
  if (db.users.find(u => u.username.toLowerCase() === normalized.toLowerCase())) return res.status(409).json({ error: "nom d'utilisateur déjà pris" });

  const isAdmin = ADMIN_USERNAMES.includes(normalized.toLowerCase());
  const user = {
    id: uid(),
    username: normalized,
    name: String(name).trim() || normalized,
    passwordHash: await bcrypt.hash(String(password), 10),
    bio: '',
    avatar: '',
    role: isAdmin ? 'admin' : 'user',
    createdAt: Date.now()
  };

  db.users.push(user);
  save();

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '365d' });
  res.json({ token, user: pubUser(user) });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = db.users.find(u => u.username.toLowerCase() === String(username || '').toLowerCase());
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) return res.status(401).json({ error: 'identifiants incorrects' });

  ensureUserRole(user);
  if (ADMIN_USERNAMES.includes(String(username || '').toLowerCase())) user.role = 'admin';
  save();

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '365d' });
  res.json({ token, user: pubUser(user) });
});

// ---------- Profil ----------
app.get('/api/me', auth, (req, res) => {
  const u = db.users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'compte introuvable' });
  res.json(pubUser(ensureUserRole(u)));
});

app.put('/api/me', auth, (req, res) => {
  const u = db.users.find(x => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'compte introuvable' });
  const { name, bio, avatar, password } = req.body || {};
  if (name) u.name = String(name).slice(0, 50);
  if (bio !== undefined) u.bio = String(bio).slice(0, 200);
  if (avatar !== undefined) u.avatar = String(avatar).slice(0, 500000);
  if (password && String(password).length >= 4) u.passwordHash = bcrypt.hashSync(String(password), 10);
  ensureUserRole(u);
  save();
  res.json(pubUser(u));
});

app.delete('/api/me', auth, (req, res) => {
  const id = req.user.id;
  db.users = db.users.filter(u => u.id !== id);
  db.friends = db.friends.filter(f => f.a !== id && f.b !== id);
  db.messages = db.messages.filter(m => m.from !== id && m.to !== id);
  db.posts = db.posts.filter(p => p.userId !== id);
  save();
  const ws = sockets.get(id); if (ws) try { ws.close(); } catch {}
  res.json({ ok: true });
});

// ---------- Recherche utilisateurs ----------
app.get('/api/users/search', auth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json([]);
  const results = db.users
    .filter(u => u.id !== req.user.id && (u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)))
    .slice(0, 20)
    .map(pubUser);
  res.json(results);
});

// ---------- Amis ----------
function friendRow(a, b) { return db.friends.find(f => (f.a === a && f.b === b) || (f.a === b && f.b === a)); }

app.get('/api/friends', auth, (req, res) => {
  const id = req.user.id;
  const list = db.friends
    .filter(f => (f.a === id || f.b === id) && f.status === 'accepted')
    .map(f => {
      const fid = f.a === id ? f.b : f.a;
      const u = db.users.find(x => x.id === fid);
      return u ? pubUser(u) : null;
    })
    .filter(Boolean);
  res.json(list);
});

app.get('/api/friends/requests', auth, (req, res) => {
  const id = req.user.id;
  const reqs = db.friends
    .filter(f => f.b === id && f.status === 'pending')
    .map(f => {
      const u = db.users.find(x => x.id === f.a);
      return u ? pubUser(u) : null;
    })
    .filter(Boolean);
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
  row.status = 'accepted';
  save();
  sendTo(userId, { type: 'friend-accepted', from: pubUser(db.users.find(u => u.id === req.user.id)) });
  res.json({ ok: true });
});

app.post('/api/friends/remove', auth, (req, res) => {
  const { userId } = req.body || {};
  db.friends = db.friends.filter(f => !((f.a === req.user.id && f.b === userId) || (f.a === userId && f.b === req.user.id)));
  save();
  res.json({ ok: true });
});

// ---------- Messages ----------
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
    image: image ? String(image).slice(0, 500000) : '',
    createdAt: Date.now()
  };
  db.messages.push(msg);
  save();
  sendTo(toUserId, { type: 'message', message: msg });
  res.json(msg);
});

// ---------- BARAZA feed ----------
app.get('/api/feed/public', (req, res) => {
  const posts = db.posts
    .filter(p => p.visibility !== 'friends')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 50)
    .map(serializePost);
  res.json(posts);
});

app.get('/api/feed', auth, (req, res) => {
  const me = req.user.id;
  const friendIds = new Set(
    db.friends
      .filter(f => f.status === 'accepted' && (f.a === me || f.b === me))
      .map(f => f.a === me ? f.b : f.a)
  );

  const posts = db.posts
    .filter(p => p.userId === me || p.visibility === 'public' || friendIds.has(p.userId))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 100)
    .map(post => ({ ...serializePost(post), isFriend: friendIds.has(post.userId) }));

  res.json(posts);
});

app.post('/api/posts', auth, (req, res) => {
  const me = req.user.id;
  const { text, image, visibility } = req.body || {};
  if ((!text || !String(text).trim()) && !image) return res.status(400).json({ error: 'contenu requis' });

  const safeVisibility = visibility === 'friends' ? 'friends' : 'public';
  const post = {
    id: 'p' + (db.nextId++),
    userId: me,
    text: String(text || '').slice(0, 2000),
    image: image ? String(image).slice(0, 500000) : '',
    visibility: safeVisibility,
    createdAt: Date.now()
  };

  db.posts.push(post);
  save();
  res.json(serializePost(post));
});

// ---------- Administration ----------
app.get('/api/admin/stats', auth, requireAdmin, (req, res) => {
  const totalUsers = db.users.length;
  const adminCount = db.users.filter(u => isAdminUser(ensureUserRole(u))).length;
  const activeFriends = db.friends.filter(f => f.status === 'accepted').length;
  const totalMessages = db.messages.length;
  const totalPosts = db.posts.length;
  const pendingRequests = db.friends.filter(f => f.status === 'pending').length;

  res.json({
    totalUsers,
    adminCount,
    activeFriends,
    totalMessages,
    totalPosts,
    pendingRequests
  });
});

app.get('/api/admin/users', auth, requireAdmin, (req, res) => {
  const users = db.users
    .map(u => pubUser(ensureUserRole(u)))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(users);
});

// ---------- WebSocket ----------
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
});
