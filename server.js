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

let db = {
  users: [],
  friends: [],
  messages: [],
  posts: [],
  nextId: 1
};

function ensureDataFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], friends: [], messages: [], posts: [], nextId: 1 }, null, 2));
    }
  } catch (error) {
    console.warn('Impossible de créer data.json:', error.message);
  }
}

function load() {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    db = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      nextId: Number(parsed.nextId) || 1
    };
  } catch (error) {
    console.warn('Erreur de lecture de data.json, réinitialisation du stockage local:', error.message);
    db = { users: [], friends: [], messages: [], posts: [], nextId: 1 };
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (saveError) {
      console.warn('Impossible d’écrire le fichier de données:', saveError.message);
    }
  }
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (error) {
    console.warn('Impossible de sauvegarder les données:', error.message);
  }
}

load();
setInterval(save, 5000);

const uid = () => 'u' + (db.nextId++);
const postUid = () => 'p' + (db.nextId++);
const commentUid = () => 'c' + (db.nextId++);

const app = express();
app.use(express.json({ limit: '20mb' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const sockets = new Map();

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'non authentifié' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'session expirée' });
  }
}

function pubUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    bio: u.bio || '',
    avatar: u.avatar || '',
    createdAt: u.createdAt
  };
}

function getUser(userId) {
  return db.users.find((u) => u.id === userId) || null;
}

function getPostAuthor(post) {
  return pubUser(getUser(post.userId));
}

function serializePost(post, currentUserId = null) {
  const author = getPostAuthor(post);
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const shares = Array.isArray(post.shares) ? post.shares : [];

  return {
    id: post.id,
    userId: post.userId,
    text: post.text || '',
    image: post.image || '',
    createdAt: post.createdAt,
    visibility: post.visibility || 'public',
    author,
    likedByMe: currentUserId ? likes.includes(currentUserId) : false,
    likesCount: likes.length,
    comments: comments.map((comment) => ({
      id: comment.id,
      userId: comment.userId,
      text: comment.text || '',
      createdAt: comment.createdAt,
      author: pubUser(getUser(comment.userId))
    })),
    commentsCount: comments.length,
    sharesCount: shares.length,
    sharedFrom: post.sharedFrom || null
  };
}

function sendTo(userId, obj) {
  const ws = sockets.get(userId);
  if (ws && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {}
  }
}

// ---------- Auth ----------
app.post('/api/register', async (req, res) => {
  const { username, name, password } = req.body || {};
  if (!username || !name || !password || password.length < 4) {
    return res.status(400).json({ error: 'champs invalides (mot de passe ≥ 4 caractères)' });
  }

  const normalizedUsername = String(username).trim();
  if (db.users.find((u) => u.username.toLowerCase() === normalizedUsername.toLowerCase())) {
    return res.status(409).json({ error: "nom d'utilisateur déjà pris" });
  }

  const user = {
    id: uid(),
    username: normalizedUsername,
    name: String(name).trim(),
    passwordHash: await bcrypt.hash(password, 10),
    bio: '',
    avatar: '',
    createdAt: Date.now()
  };

  db.users.push(user);
  save();

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '365d' });
  return res.json({ token, user: pubUser(user) });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = db.users.find(
    (u) => u.username.toLowerCase() === String(username || '').trim().toLowerCase()
  );

  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return res.status(401).json({ error: 'identifiants incorrects' });
  }

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '365d' });
  return res.json({ token, user: pubUser(user) });
});

// ---------- Profil ----------
app.get('/api/me', auth, (req, res) => {
  const u = db.users.find((x) => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'compte introuvable' });
  return res.json(pubUser(u));
});

app.put('/api/me', auth, (req, res) => {
  const u = db.users.find((x) => x.id === req.user.id);
  if (!u) return res.status(404).json({ error: 'compte introuvable' });

  const { name, bio, avatar, password } = req.body || {};
  if (name) u.name = String(name).slice(0, 50).trim();
  if (bio !== undefined) u.bio = String(bio).slice(0, 200);
  if (avatar !== undefined) u.avatar = String(avatar).slice(0, 500000);
  if (password && String(password).length >= 4) {
    u.passwordHash = bcrypt.hashSync(String(password), 10);
  }

  save();
  return res.json(pubUser(u));
});

app.delete('/api/me', auth, (req, res) => {
  const id = req.user.id;
  db.users = db.users.filter((u) => u.id !== id);
  db.friends = db.friends.filter((f) => f.a !== id && f.b !== id);
  db.messages = db.messages.filter((m) => m.from !== id && m.to !== id);
  db.posts = db.posts.filter((p) => p.userId !== id);
  save();

  const ws = sockets.get(id);
  if (ws) try { ws.close(); } catch {}
  return res.json({ ok: true });
});

// ---------- Recherche utilisateurs ----------
app.get('/api/users/search', auth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) return res.json([]);

  const results = db.users
    .filter((u) => u.id !== req.user.id && (u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)))
    .slice(0, 20)
    .map(pubUser);

  return res.json(results);
});

// ---------- Amis ----------
function friendRow(a, b) {
  return db.friends.find((f) => (f.a === a && f.b === b) || (f.a === b && f.b === a));
}

app.get('/api/friends', auth, (req, res) => {
  const id = req.user.id;
  const list = db.friends
    .filter((f) => (f.a === id || f.b === id) && f.status === 'accepted')
    .map((f) => {
      const fid = f.a === id ? f.b : f.a;
      const u = db.users.find((x) => x.id === fid);
      return u ? pubUser(u) : null;
    })
    .filter(Boolean);

  return res.json(list);
});

app.get('/api/friends/requests', auth, (req, res) => {
  const id = req.user.id;
  const reqs = db.friends
    .filter((f) => f.b === id && f.status === 'pending')
    .map((f) => {
      const u = db.users.find((x) => x.id === f.a);
      return u ? pubUser(u) : null;
    })
    .filter(Boolean);

  return res.json(reqs);
});

app.post('/api/friends/request', auth, (req, res) => {
  const { userId } = req.body || {};
  const me = req.user.id;

  if (!userId || userId === me) return res.status(400).json({ error: 'invalide' });
  if (!db.users.find((u) => u.id === userId)) return res.status(404).json({ error: 'utilisateur introuvable' });
  if (friendRow(me, userId)) return res.status(409).json({ error: 'déjà ami ou demande en cours' });

  db.friends.push({ a: me, b: userId, status: 'pending' });
  save();
  sendTo(userId, { type: 'friend-request', from: pubUser(db.users.find((u) => u.id === me)) });

  return res.json({ ok: true });
});

app.post('/api/friends/accept', auth, (req, res) => {
  const { userId } = req.body || {};
  const row = friendRow(req.user.id, userId);

  if (!row || row.status !== 'pending') return res.status(404).json({ error: 'demande introuvable' });

  row.status = 'accepted';
  save();
  sendTo(userId, { type: 'friend-accepted', from: pubUser(db.users.find((u) => u.id === req.user.id)) });

  return res.json({ ok: true });
});

app.post('/api/friends/remove', auth, (req, res) => {
  const { userId } = req.body || {};
  db.friends = db.friends.filter(
    (f) => !((f.a === req.user.id && f.b === userId) || (f.a === userId && f.b === req.user.id))
  );
  save();
  return res.json({ ok: true });
});

// ---------- Messages ----------
app.get('/api/messages/:friendId', auth, (req, res) => {
  const me = req.user.id;
  const fid = req.params.friendId;
  const row = friendRow(me, fid);

  if (!row || row.status !== 'accepted') return res.status(403).json({ error: 'pas ami' });

  const msgs = db.messages
    .filter((m) => (m.from === me && m.to === fid) || (m.from === fid && m.to === me))
    .slice(-100);

  return res.json(msgs);
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
  return res.json(msg);
});

// ---------- Baraza / Feed ----------
app.get('/api/posts', auth, (req, res) => {
  const posts = [...db.posts]
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .map((post) => serializePost(post, req.user.id));

  return res.json(posts);
});

app.post('/api/posts', auth, (req, res) => {
  const { text, image } = req.body || {};
  const cleanText = String(text || '').trim();
  const cleanImage = String(image || '').trim();

  if (!cleanText && !cleanImage) {
    return res.status(400).json({ error: 'ajoutez un texte ou une photo' });
  }

  const post = {
    id: postUid(),
    userId: req.user.id,
    text: cleanText.slice(0, 2500),
    image: cleanImage.slice(0, 500000),
    createdAt: Date.now(),
    visibility: 'public',
    likes: [],
    shares: [],
    comments: []
  };

  db.posts.push(post);
  save();
  return res.json(serializePost(post, req.user.id));
});

app.post('/api/posts/:postId/comment', auth, (req, res) => {
  const { text } = req.body || {};
  const cleanText = String(text || '').trim();
  if (!cleanText) return res.status(400).json({ error: 'le commentaire est vide' });

  const post = db.posts.find((p) => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: 'publication introuvable' });

  post.comments = Array.isArray(post.comments) ? post.comments : [];
  post.comments.push({
    id: commentUid(),
    userId: req.user.id,
    text: cleanText.slice(0, 500),
    createdAt: Date.now()
  });
  save();

  return res.json(serializePost(post, req.user.id));
});

app.post('/api/posts/:postId/like', auth, (req, res) => {
  const post = db.posts.find((p) => p.id === req.params.postId);
  if (!post) return res.status(404).json({ error: 'publication introuvable' });

  post.likes = Array.isArray(post.likes) ? post.likes : [];
  const idx = post.likes.indexOf(req.user.id);
  if (idx >= 0) {
    post.likes.splice(idx, 1);
  } else {
    post.likes.push(req.user.id);
  }
  save();

  return res.json(serializePost(post, req.user.id));
});

app.post('/api/posts/:postId/share', auth, (req, res) => {
  const sourcePost = db.posts.find((p) => p.id === req.params.postId);
  if (!sourcePost) return res.status(404).json({ error: 'publication introuvable' });

  const share = {
    id: postUid(),
    userId: req.user.id,
    text: sourcePost.text || '',
    image: sourcePost.image || '',
    createdAt: Date.now(),
    visibility: 'public',
    likes: [],
    shares: [],
    comments: [],
    sharedFrom: {
      id: sourcePost.id,
      text: sourcePost.text || '',
      image: sourcePost.image || '',
      author: pubUser(getUser(sourcePost.userId))
    }
  };

  db.posts.push(share);
  save();
  return res.json(serializePost(share, req.user.id));
});

app.get('/api/hello', (req, res) => {
  res.json({
    message: '✅ BARAZANI Server is running!',
    time: new Date().toISOString()
  });
});

// ---------- WebSocket ----------
wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://x').searchParams.get('token');
  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch {
    ws.close();
    return;
  }

  sockets.set(user.id, ws);
  ws.on('close', () => {
    if (sockets.get(user.id) === ws) sockets.delete(user.id);
  });
});

server.listen(PORT, () => {
  console.log(`BARAZANI Online - listening on http://0.0.0.0:${PORT}`);
});
