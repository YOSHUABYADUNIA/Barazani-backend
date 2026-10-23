// BARAZANI Online — SPA client
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
let S = {
  token: localStorage.getItem('bz_token') || '',
  user: null,
  view: 'auth',
  tab: 'baraza',
  friends: [],
  requests: [],
  search: [],
  chatWith: null,
  messages: [],
  ws: null,
  rec: null,
  recChunks: [],
  feed: [],
  adminStats: null,
  adminUsers: []
};

const api = async (path, opts = {}) => {
  const r = await fetch('/api' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}), ...(opts.headers || {}) }
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'erreur ' + r.status);
  return data;
};

const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const avatarHtml = (u, cls = 'avatar') => `<div class="${cls}">${u.avatar ? `<img src="data:image/jpeg;base64,${u.avatar}">` : esc((u.name || u.username || '?').charAt(0).toUpperCase())}</div>`;

function connectWs() {
  if (!S.token) return;
  try { S.ws && S.ws.close(); } catch {}
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  S.ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(S.token)}`);
  S.ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.type === 'message' && S.view === 'chat' && S.chatWith && (d.message.from === S.chatWith.id || d.message.to === S.chatWith.id)) {
      S.messages.push(d.message); renderChat();
    } else if (d.type === 'message' || d.type === 'friend-request' || d.type === 'friend-accepted') {
      loadFriends();
    }

    if (d.type === 'friend-request' || d.type === 'friend-accepted' || d.type === 'message') {
      if (S.user && S.tab === 'baraza') loadFeed();
    }
  };
}

async function loadFriends() {
  try {
    S.friends = await api('/friends');
    S.requests = await api('/friends/requests');
    if (S.view === 'main') renderMain();
  } catch {}
}

async function loadFeed() {
  if (!S.user) {
    S.feed = await api('/feed/public');
    return S.feed;
  }
  S.feed = await api('/feed');
  return S.feed;
}

async function loadAdminData() {
  if (!S.user || S.user.role !== 'admin') return;
  try {
    S.adminStats = await api('/admin/stats');
    S.adminUsers = await api('/admin/users');
  } catch (e) {
    S.adminStats = null;
    S.adminUsers = [];
    alert(e.message);
  }
}

// ---------- Auth view ----------
function renderAuth(mode = 'login', err = '') {
  S.view = 'auth';
  app.innerHTML = `
    <div class="auth">
      <h1>BARAZANI</h1>
      <p class="tag">Sauti ya pamoja — Voix commune, en ligne</p>
      <div class="tabs">
        <button class="${mode === 'login' ? 'active' : ''}" onclick="renderAuth('login')">Connexion</button>
        <button class="${mode === 'register' ? 'active' : ''}" onclick="renderAuth('register')">Créer un compte</button>
      </div>
      ${mode === 'register' ? '<input id="f_name" placeholder="Nom affiché" autocomplete="name">' : ''}
      <input id="f_username" placeholder="Nom d'utilisateur" autocomplete="username">
      <input id="f_password" type="password" placeholder="Mot de passe" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
      <div class="err">${esc(err)}</div>
      <button class="btn" onclick="doAuth('${mode}')">${mode === 'login' ? 'Se connecter' : "S'inscrire"}</button>
      <button class="btn ghost" onclick="openPublicBaraza()">Voir le fil public</button>
    </div>`;
}
window.renderAuth = renderAuth;

window.openPublicBaraza = async () => {
  try {
    const feed = await loadFeed();
    renderPublicBaraza(feed);
  } catch (e) {
    renderPublicBaraza([]);
  }
};

function renderPublicBaraza(feed = []) {
  S.view = 'baraza-public';
  app.innerHTML = `
    <div class="header">
      <button class="back" onclick="renderAuth()">‹</button>
      <h2>BARAZA</h2>
    </div>
    <div class="list public-feed">
      ${feed.length ? feed.map(post => `
        <div class="post-card">
          <div class="post-head">
            ${avatarHtml(post.author || { name: 'User', username: 'user' })}
            <div class="post-meta">
              <div class="post-name">${esc(post.author?.name || 'Utilisateur')}</div>
              <div class="post-sub">@${esc(post.author?.username || 'user')} · ${new Date(post.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
          <div class="post-body">${esc(post.text || '')}</div>
          ${post.image ? `<img class="post-image" src="data:image/jpeg;base64,${post.image}">` : ''}
        </div>
      `).join('') : '<div class="empty">Aucun message public pour le moment.</div>'}
    </div>
  `;
}

window.doAuth = async (mode) => {
  const username = $('#f_username').value.trim();
  const password = $('#f_password').value;
  const name = $('#f_name') ? $('#f_name').value.trim() : username;
  try {
    const r = await api('/' + mode, { method: 'POST', body: JSON.stringify({ username, name, password }) });
    S.token = r.token;
    S.user = r.user;
    localStorage.setItem('bz_token', S.token);
    connectWs();
    S.view = 'main';
    S.tab = 'baraza';
    await loadFriends();
    await loadFeed();
    renderMain();
  } catch (e) { renderAuth(mode, e.message); }
};

// ---------- Main view ----------
function renderMain() {
  if (!S.user) return renderAuth();
  S.view = 'main';
  const reqBadge = S.requests.length ? `<span class="badge">${S.requests.length}</span>` : '';
  app.innerHTML = `
    <div class="header">
      <h2>${S.tab === 'baraza' ? 'BARAZA' : S.tab === 'chats' ? 'Discussions' : S.tab === 'search' ? 'Rechercher' : S.tab === 'profile' ? 'Mon profil' : 'Administration'}</h2>
      ${S.user ? avatarHtml(S.user) : ''}
    </div>
    <div class="list" id="list"></div>
    <div class="nav">
      <button class="${S.tab === 'baraza' ? 'active' : ''}" onclick="switchTab('baraza')"><span class="ic">📰</span>Baraza</button>
      <button class="${S.tab === 'chats' ? 'active' : ''}" onclick="switchTab('chats')"><span class="ic">💬</span>Amis${reqBadge}</button>
      <button class="${S.tab === 'search' ? 'active' : ''}" onclick="switchTab('search')"><span class="ic">🔍</span>Recherche</button>
      <button class="${S.tab === 'profile' ? 'active' : ''}" onclick="switchTab('profile')"><span class="ic">👤</span>Profil</button>
      ${S.user.role === 'admin' ? '<button class="' + (S.tab === 'admin' ? 'active' : '') + '" onclick="switchTab(\'admin\')"><span class="ic">🛡️</span>Admin</button>' : ''}
    </div>`;

  const list = $('#list');
  if (S.tab === 'baraza') {
    renderBaraza(list);
  } else if (S.tab === 'chats') {
    let html = '';
    S.requests.forEach(u => {
      html += `<div class="row"><div class="info"><div class="name">${esc(u.name)}</div><div class="sub">@${esc(u.username)} — demande d'ami</div></div><button class="accept" onclick="acceptFriend('${u.id}')">Accepter</button></div>`;
    });
    if (S.friends.length === 0 && S.requests.length === 0) html = '<div class="empty">Aucun ami pour le moment.<br>Allez dans l\'onglet Recherche pour trouver et ajouter des amis.</div>';
    S.friends.forEach(u => {
      html += `<div class="row" onclick="openChat('${u.id}')">${avatarHtml(u)}<div class="info"><div class="name">${esc(u.name)}</div><div class="sub">@${esc(u.username)}</div></div>›</div>`;
    });
    list.innerHTML = html;
  } else if (S.tab === 'search') {
    list.innerHTML = `
      <div class="searchbar"><input id="q" placeholder="Rechercher par nom ou @pseudo…" oninput="doSearch(this.value)"></div>
      <div id="results"></div>`;
  } else if (S.tab === 'admin') {
    renderAdmin(list);
  } else {
    renderProfile(list);
  }
}

function renderBaraza(container) {
  if (!S.feed || S.feed.length === 0) {
    container.innerHTML = `
      <div class="feed-creator">
        <textarea id="postText" rows="3" maxlength="500" placeholder="Partagez quelque chose avec BARAZA…"></textarea>
        <div class="post-actions">
          <button class="btn" onclick="createPost()">Publier</button>
        </div>
      </div>
      <div class="empty">Le fil est vide pour le moment.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="feed-creator">
      <textarea id="postText" rows="3" maxlength="500" placeholder="Partagez quelque chose avec BARAZA…"></textarea>
      <div class="post-actions">
        <button class="btn" onclick="createPost()">Publier</button>
      </div>
    </div>
    ${S.feed.map(post => `
      <div class="post-card">
        <div class="post-head">
          ${avatarHtml(post.author || { name: 'User', username: 'user' })}
          <div class="post-meta">
            <div class="post-name">${esc(post.author?.name || 'Utilisateur')}</div>
            <div class="post-sub">@${esc(post.author?.username || 'user')} · ${new Date(post.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
        <div class="post-body">${esc(post.text || '')}</div>
        ${post.image ? `<img class="post-image" src="data:image/jpeg;base64,${post.image}">` : ''}
        <div class="post-visibility">${post.visibility === 'friends' ? 'Amis seulement' : 'Public'}</div>
      </div>
    `).join('')}
  `;
}

window.createPost = async () => {
  const text = $('#postText')?.value.trim();
  if (!text) return;
  try {
    await api('/posts', { method: 'POST', body: JSON.stringify({ text, visibility: 'public' }) });
    $('#postText').value = '';
    S.feed = await api('/feed');
    renderMain();
  } catch (e) { alert(e.message); }
};

window.switchTab = async (t) => {
  S.tab = t;
  if (t === 'baraza' && S.user) {
    try { await loadFeed(); } catch {}
  }
  if (t === 'admin' && S.user?.role === 'admin') {
    try { await loadAdminData(); } catch {}
  }
  renderMain();
};

window.doSearch = async (q) => {
  if (!q.trim()) { $('#results').innerHTML = ''; return; }
  try {
    S.search = await api('/users/search?q=' + encodeURIComponent(q));
    $('#results').innerHTML = S.search.length === 0 ? '<div class="empty">Aucun utilisateur trouvé</div>' :
      S.search.map(u => {
        const isFriend = S.friends.some(f => f.id === u.id);
        const isReq = S.requests.some(r => r.id === u.id);
        const btn = isFriend ? '<button class="pending">Ami ✓</button>' : isReq ? '<button class="pending">Envoyée</button>' : `<button class="add" onclick="addFriend('${u.id}')">+ Ajouter</button>`;
        return `<div class="row">${avatarHtml(u)}<div class="info"><div class="name">${esc(u.name)}</div><div class="sub">@${esc(u.username)}${u.bio ? ' — ' + esc(u.bio) : ''}</div></div>${btn}</div>`;
      }).join('');
  } catch {}
};

window.addFriend = async (id) => { try { await api('/friends/request', { method: 'POST', body: JSON.stringify({ userId: id }) }); doSearch($('#q').value); } catch (e) { alert(e.message); } };
window.acceptFriend = async (id) => { try { await api('/friends/accept', { method: 'POST', body: JSON.stringify({ userId: id }) }); loadFriends(); } catch (e) { alert(e.message); } };

// ---------- Profile ----------
function renderProfile(container) {
  const u = S.user || {};
  container.innerHTML = `
    <div class="profile">
      <div class="big-avatar" id="bigAv">${u.avatar ? `<img src="data:image/jpeg;base64,${u.avatar}">` : esc((u.name || '?').charAt(0).toUpperCase())}</div>
      <div class="section">Nom affiché</div>
      <input id="p_name" value="${esc(u.name || '')}">
      <div class="section">Bio</div>
      <textarea id="p_bio" rows="2" maxlength="200" placeholder="Décrivez-vous…">${esc(u.bio || '')}</textarea>
      <div class="section">Photo de profil (optionnel)</div>
      <input type="file" id="p_avatar" accept="image/*" style="padding:8px 0">
      <div class="section">Nouveau mot de passe (laisser vide pour ne pas changer)</div>
      <input id="p_pass" type="password" placeholder="••••••">
      <button class="btn" onclick="saveProfile()">Enregistrer les modifications</button>
      <div class="section">Compte</div>
      <button class="btn ghost" onclick="logout()">Se déconnecter</button>
      <button class="btn danger" onclick="deleteAccount()">Supprimer mon compte (définitif)</button>
    </div>`;
  $('#p_avatar').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image(); const url = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement('canvas'); const max = 200;
      let w = img.width, h = img.height;
      if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; }
      c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      S._newAvatar = c.toDataURL('image/jpeg', 0.7).split(',')[1];
      $('#bigAv').innerHTML = `<img src="data:image/jpeg;base64,${S._newAvatar}">`;
    };
    img.src = url;
  };
}
window.saveProfile = async () => {
  try {
    const body = { name: $('#p_name').value, bio: $('#p_bio').value };
    if (S._newAvatar) body.avatar = S._newAvatar;
    if ($('#p_pass').value) body.password = $('#p_pass').value;
    S.user = await api('/me', { method: 'PUT', body: JSON.stringify(body) });
    S._newAvatar = null;
    alert('Profil enregistré ✓');
    renderMain();
  } catch (e) { alert(e.message); }
};

window.logout = () => { S.token = ''; S.user = null; localStorage.removeItem('bz_token'); try { S.ws.close(); } catch {} renderAuth(); };
window.deleteAccount = async () => {
  if (!confirm('Supprimer définitivement votre compte et toutes vos données ?')) return;
  try { await api('/me', { method: 'DELETE' }); logout(); } catch (e) { alert(e.message); }
};

function renderAdmin(container) {
  if (!S.user || S.user.role !== 'admin') {
    container.innerHTML = '<div class="empty">Accès administrateur requis.</div>';
    return;
  }

  const stats = S.adminStats || { totalUsers: 0, adminCount: 0, totalPosts: 0, activeFriends: 0, totalMessages: 0, pendingRequests: 0 };
  const users = S.adminUsers || [];

  container.innerHTML = `
    <div class="admin-panel">
      <div class="admin-grid">
        <div class="admin-card"><span>Total utilisateurs</span><strong>${stats.totalUsers}</strong></div>
        <div class="admin-card"><span>Administrateurs</span><strong>${stats.adminCount}</strong></div>
        <div class="admin-card"><span>Publications</span><strong>${stats.totalPosts}</strong></div>
        <div class="admin-card"><span>Amis validés</span><strong>${stats.activeFriends}</strong></div>
        <div class="admin-card"><span>Messages</span><strong>${stats.totalMessages}</strong></div>
        <div class="admin-card"><span>Demandes</span><strong>${stats.pendingRequests}</strong></div>
      </div>
      <div class="admin-list">
        <h3>Utilisateurs</h3>
        ${users.length ? users.map(u => `
          <div class="row admin-row">
            ${avatarHtml(u)}
            <div class="info">
              <div class="name">${esc(u.name)}</div>
              <div class="sub">@${esc(u.username)} · ${u.role === 'admin' ? 'Admin' : 'Utilisateur'}</div>
            </div>
            <span class="role-badge ${u.role === 'admin' ? 'admin' : 'user'}">${u.role === 'admin' ? 'Admin' : 'User'}</span>
          </div>
        `).join('') : '<div class="empty">Aucun utilisateur.</div>'}
      </div>
    </div>
  `;
}

// ---------- Chat ----------
window.openChat = async (id) => {
  S.chatWith = S.friends.find(f => f.id === id);
  S.view = 'chat';
  try { S.messages = await api('/messages/' + id); } catch { S.messages = []; }
  renderChat();
};

function renderChat() {
  const u = S.chatWith;
  S.view = 'chat';
  app.innerHTML = `
    <div class="header"><button class="back" onclick="renderMain()">‹</button>${avatarHtml(u)}<div style="flex:1"><div style="font-weight:700;font-size:15px">${esc(u.name)}</div><div style="font-size:12px;color:#9fb0c8">@${esc(u.username)}</div></div></div>
    <div class="chat" id="chat"></div>
    <div class="composer">
      <button class="iconbtn" id="recBtn" title="Message vocal (Opus)">🎤</button>
      <button class="iconbtn" title="Photo" onclick="$('#photoInput').click()">📷</button>
      <input type="file" id="photoInput" accept="image/*" class="hidden">
      <input id="msgText" placeholder="Message…" onkeydown="if(event.key==='Enter')sendText()">
      <button class="iconbtn" style="background:#d4a017;color:#14233c" onclick="sendText()">➤</button>
    </div>`;
  const chat = $('#chat');
  chat.innerHTML = S.messages.length === 0 ? '<div class="empty">Dites bonjour à ' + esc(u.name) + ' ! 👋</div>' :
    S.messages.map(m => {
      const me = m.from === S.user.id;
      let body = '';
      if (m.type === 'image' && m.image) body = `<img src="data:image/jpeg;base64,${m.image}">`;
      else if (m.type === 'voice' && m.audio) body = `<button class="play" onclick="playVoice('${m.id}')">▶ Écouter (vocal)</button><audio id="aud_${m.id}" src="data:audio/webm;base64,${m.audio}"></audio>`;
      else body = esc(m.text);
      return `<div class="msg ${me ? 'me' : 'them'}">${body}</div>`;
    }).join('');
  chat.scrollTop = chat.scrollHeight;
  window.playVoice = (id) => { const a = $('#aud_' + id); if (a) a.play(); };
  const recBtn = $('#recBtn');
  const startRec = () => {
    if (S.rec) return;
    S.recChunks = [];
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const opts = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 12000 } : {};
      S.rec = new MediaRecorder(stream, opts);
      S.rec.ondataavailable = e => e.data.size && S.recChunks.push(e.data);
      S.rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(S.recChunks, { type: 'audio/webm' });
        const fr = new FileReader();
        fr.onload = () => sendMessage({ type: 'voice', audio: fr.result.split(',')[1] });
        fr.readAsDataURL(blob);
        S.rec = null; recBtn.classList.remove('rec');
      };
      S.rec.start();
      recBtn.classList.add('rec');
    }).catch(() => alert('Micro non autorisé'));
  };
  const stopRec = () => { if (S.rec) S.rec.stop(); };
  recBtn.onmousedown = startRec; recBtn.onmouseup = stopRec;
  recBtn.ontouchstart = (e) => { e.preventDefault(); startRec(); };
  recBtn.ontouchend = (e) => { e.preventDefault(); stopRec(); };
  $('#photoInput').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return; e.target.value = '';
    const img = new Image(); const url = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement('canvas'); const max = 800;
      let w = img.width, h = img.height;
      if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; }
      c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      sendMessage({ type: 'image', image: c.toDataURL('image/jpeg', 0.6).split(',')[1] });
    };
    img.src = url;
  };
}
window.sendText = () => { const t = $('#msgText').value.trim(); if (!t) return; $('#msgText').value = ''; sendMessage({ type: 'text', text: t }); };
async function sendMessage(payload) {
  try {
    const msg = await api('/messages', { method: 'POST', body: JSON.stringify({ toUserId: S.chatWith.id, ...payload }) });
    S.messages.push(msg);
    if (S.view === 'chat') renderChat();
  } catch (e) { alert(e.message); }
}

// ---------- Boot ----------
(async () => {
  if (S.token) {
    try {
      S.user = await api('/me');
      connectWs();
      await loadFriends();
      await loadFeed();
      S.view = 'main';
      S.tab = 'baraza';
      renderMain();
      return;
    } catch { S.token = ''; localStorage.removeItem('bz_token'); }
  }
  renderAuth();
})();

window.renderMain = renderMain;
window.renderChat = renderChat;
window.loadFeed = loadFeed;
window.loadAdminData = loadAdminData;
window.renderAdmin = renderAdmin;
