const app = document.getElementById('app');

const state = {
  token: localStorage.getItem('barazaToken') || '',
  user: null,
  posts: [],
  friends: [],
  friendRequests: [],
  searchResults: [],
  pendingImage: '',
  currentView: 'home'
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatRelativeTime = (timestamp) => {
  const diffMs = Date.now() - Number(timestamp || 0);
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `il y a ${diffDays} j`;
  return new Date(Number(timestamp)).toLocaleDateString('fr-FR');
};

async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, { ...options, headers });
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Une erreur est survenue.');
  }

  return data;
}

async function loadMe() {
  if (!state.token) return;
  try {
    state.user = await apiFetch('/api/me');
    await loadDashboardData();
  } catch {
    localStorage.removeItem('barazaToken');
    state.token = '';
    state.user = null;
  }
}

async function loadDashboardData() {
  if (!state.token) return;
  await Promise.all([
    loadPosts(),
    loadFriends(),
    loadFriendRequests(),
    searchUsers('')
  ]);
}

async function loadPosts() {
  if (!state.token) {
    state.posts = [];
    return;
  }

  const posts = await apiFetch('/api/posts');
  state.posts = Array.isArray(posts) ? posts : [];
}

async function loadFriends() {
  if (!state.token) {
    state.friends = [];
    return;
  }

  try {
    const list = await apiFetch('/api/friends');
    state.friends = Array.isArray(list) ? list : [];
  } catch {
    state.friends = [];
  }
}

async function loadFriendRequests() {
  if (!state.token) {
    state.friendRequests = [];
    return;
  }

  try {
    const list = await apiFetch('/api/friends/requests');
    state.friendRequests = Array.isArray(list) ? list : [];
  } catch {
    state.friendRequests = [];
  }
}

async function searchUsers(term) {
  if (!state.token) {
    state.searchResults = [];
    return;
  }

  const q = String(term || '').trim();
  if (!q) {
    state.searchResults = [];
    return;
  }

  try {
    const results = await apiFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    state.searchResults = Array.isArray(results) ? results : [];
  } catch {
    state.searchResults = [];
  }
}

async function requestFriend(userId) {
  try {
    await apiFetch('/api/friends/request', {
      method: 'POST',
      body: { userId }
    });
    await loadFriends();
    await searchUsers(document.querySelector('#userSearch')?.value || '');
    render();
  } catch (error) {
    alert(error.message);
  }
}

async function acceptFriend(userId) {
  try {
    await apiFetch('/api/friends/accept', {
      method: 'POST',
      body: { userId }
    });
    await loadFriends();
    await loadFriendRequests();
    render();
  } catch (error) {
    alert(error.message);
  }
}

async function removeFriend(userId) {
  try {
    await apiFetch('/api/friends/remove', {
      method: 'POST',
      body: { userId }
    });
    await loadFriends();
    render();
  } catch (error) {
    alert(error.message);
  }
}

async function registerUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.username.value.trim();
  const name = form.name.value.trim();
  const password = form.password.value;
  const errorNode = form.querySelector('.form-error');

  try {
    const result = await apiFetch('/api/register', {
      method: 'POST',
      body: { username, name, password }
    });

    state.token = result.token;
    state.user = result.user;
    localStorage.setItem('barazaToken', state.token);
    form.reset();
    await loadDashboardData();
    render();
  } catch (error) {
    errorNode.textContent = error.message;
  }
}

async function loginUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.username.value.trim();
  const password = form.password.value;
  const errorNode = form.querySelector('.form-error');

  try {
    const result = await apiFetch('/api/login', {
      method: 'POST',
      body: { username, password }
    });

    state.token = result.token;
    state.user = result.user;
    localStorage.setItem('barazaToken', state.token);
    form.reset();
    await loadDashboardData();
    render();
  } catch (error) {
    errorNode.textContent = error.message;
  }
}

async function publishPost(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const text = form.text.value.trim();
  const image = state.pendingImage || form.image.value.trim();

  if (!text && !image) {
    return;
  }

  try {
    const result = await apiFetch('/api/posts', {
      method: 'POST',
      body: { text, image }
    });

    state.posts = [result, ...state.posts];
    state.pendingImage = '';
    form.reset();
    render();
  } catch (error) {
    alert(error.message);
  }
}

async function likePost(postId) {
  try {
    const updated = await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
    state.posts = state.posts.map((post) => (post.id === updated.id ? updated : post));
    render();
  } catch (error) {
    alert(error.message);
  }
}

async function sharePost(postId) {
  try {
    const updated = await apiFetch(`/api/posts/${postId}/share`, { method: 'POST' });
    state.posts = [updated, ...state.posts];
    render();
  } catch (error) {
    alert(error.message);
  }
}

async function commentPost(postId, text) {
  if (!text.trim()) return;

  try {
    const updated = await apiFetch(`/api/posts/${postId}/comment`, {
      method: 'POST',
      body: { text }
    });

    state.posts = state.posts.map((post) => (post.id === updated.id ? updated : post));
    render();
  } catch (error) {
    alert(error.message);
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {};

  const name = form.name.value.trim();
  const bio = form.bio.value.trim();

  if (name) payload.name = name;
  if (bio !== undefined) payload.bio = bio;

  try {
    const updated = await apiFetch('/api/me', {
      method: 'PUT',
      body: payload
    });

    state.user = { ...state.user, ...updated };
    render();
  } catch (error) {
    alert(error.message);
  }
}

function renderAuth() {
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="brand-lockup">
          <div class="brand-mark">B</div>
          <div>
            <div class="brand-kicker">Réseau social</div>
            <h1>Baraza</h1>
          </div>
        </div>

        <div class="auth-panel">
          <div class="auth-tabs">
            <button class="active" data-mode="login">Connexion</button>
            <button data-mode="register">Inscription</button>
          </div>

          <form id="loginForm" class="auth-form">
            <input name="username" type="text" placeholder="Nom d'utilisateur" required />
            <input name="password" type="password" placeholder="Mot de passe" required />
            <button type="submit" class="primary-btn wide">Se connecter</button>
            <div class="form-error"></div>
          </form>

          <form id="registerForm" class="auth-form hidden">
            <input name="name" type="text" placeholder="Nom complet" required />
            <input name="username" type="text" placeholder="Nom d'utilisateur" required />
            <input name="password" type="password" placeholder="Mot de passe (4+ caractères)" required />
            <button type="submit" class="primary-btn wide">Créer mon compte</button>
            <div class="form-error"></div>
          </form>
        </div>
      </div>
    </div>
  `;

  const tabs = app.querySelectorAll('.auth-tabs button');
  const loginForm = app.querySelector('#loginForm');
  const registerForm = app.querySelector('#registerForm');

  tabs.forEach((button) => {
    button.addEventListener('click', () => {
      tabs.forEach((btn) => btn.classList.toggle('active', btn === button));
      loginForm.classList.toggle('hidden', button.dataset.mode !== 'login');
      registerForm.classList.toggle('hidden', button.dataset.mode !== 'register');
    });
  });

  loginForm.addEventListener('submit', loginUser);
  registerForm.addEventListener('submit', registerUser);
}

function renderHomePage() {
  const totalLikes = state.posts.reduce((sum, post) => sum + (post.likesCount || 0), 0);
  const initials = (state.user.name || state.user.username || 'U').charAt(0).toUpperCase();

  const postsHtml = state.posts.length
    ? state.posts
        .map((post) => {
          const author = post.author || {};
          const commentsHtml = (post.comments || []).length
            ? (post.comments || [])
                .map(
                  (comment) => `
                    <div class="comment-item">
                      <strong>${escapeHtml(comment.author?.username || 'Utilisateur')}</strong>
                      <span>${escapeHtml(comment.text || '')}</span>
                    </div>
                  `
                )
                .join('')
            : '<div class="comment-item"><strong>Baraza</strong><span>Aucun commentaire pour le moment.</span></div>';

          return `
            <article class="post-card">
              <div class="post-head">
                <div class="mini-avatar">${escapeHtml((author.name || author.username || 'U').charAt(0).toUpperCase())}</div>
                <div class="post-info">
                  <div class="post-author">${escapeHtml(author.name || author.username || 'Utilisateur')}</div>
                  <div class="post-time">${escapeHtml(formatRelativeTime(post.createdAt))}</div>
                </div>
              </div>

              ${post.sharedFrom ? '<div class="shared-tag">Partagé</div>' : ''}

              <div class="post-body">${escapeHtml(post.text || '')}</div>
              ${post.image ? `<img class="post-image" src="${escapeHtml(post.image)}" alt="Publication de ${escapeHtml(author.name || author.username || 'utilisateur')}" />` : ''}

              <div class="post-actions">
                <button class="ghost-btn ${post.likedByMe ? 'active' : ''}" data-action="like" data-post-id="${escapeHtml(post.id)}">${post.likedByMe ? '💛 Aimé' : '🤍 Aimer'} (${post.likesCount || 0})</button>
                <button class="ghost-btn" data-action="share" data-post-id="${escapeHtml(post.id)}">🔁 Partager (${post.sharesCount || 0})</button>
              </div>

              <div class="comment-list">${commentsHtml}</div>

              <form class="comment-form" data-post-id="${escapeHtml(post.id)}">
                <input name="comment" placeholder="Ajoutez un commentaire..." />
                <button type="submit" class="primary-btn small">Commenter</button>
              </form>
            </article>
          `;
        })
        .join('')
    : '<div class="empty-state">Aucune publication pour le moment. Commencez la conversation !</div>';

  const searchMarkup = state.searchResults.length
    ? state.searchResults
        .map(
          (user) => `
            <div class="person-row">
              <div class="mini-avatar">${escapeHtml((user.name || user.username || 'U').charAt(0).toUpperCase())}</div>
              <div class="person-meta">
                <strong>${escapeHtml(user.name || user.username)}</strong>
                <span>@${escapeHtml(user.username)}</span>
              </div>
              <button class="friend-btn" data-user-id="${escapeHtml(user.id)}">+ Ajouter</button>
            </div>
          `
        )
        .join('')
    : '<div class="empty-mini">Aucun résultat trouvé.</div>';

  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <div class="brand-mark">B</div>
          <div class="topbar-title">
            <small>Baraza</small>
            <strong>Accueil</strong>
          </div>
        </div>

        <div class="topbar-actions">
          <div class="nav-pills">
            <button class="active" data-view="home">Accueil</button>
            <button data-view="friends">Amis</button>
            <button data-view="profile">Profil</button>
          </div>
          <div class="searchbox">
            <input id="userSearch" type="text" placeholder="Rechercher un utilisateur" />
          </div>
          <button class="primary-btn small" id="logoutBtn">Déconnexion</button>
        </div>
      </header>

      <div class="dashboard">
        <aside class="left-panel">
          <div class="panel-card profile-card">
            <div class="profile-header">
              <div class="avatar">${escapeHtml(initials)}</div>
              <div>
                <div class="profile-name">${escapeHtml(state.user.name || state.user.username)}</div>
                <div class="profile-handle">@${escapeHtml(state.user.username)}</div>
              </div>
            </div>

            <p class="profile-bio">${escapeHtml(state.user.bio || 'Membre actif de la communauté Baraza.')}</p>

            <div class="mini-stats">
              <div class="mini-stat">
                <strong>${state.posts.length}</strong>
                <span>Posts</span>
              </div>
              <div class="mini-stat">
                <strong>${totalLikes}</strong>
                <span>Likes</span>
              </div>
            </div>
          </div>

          <div class="panel-card">
            <h3 class="section-title">Découvrir</h3>
            <div class="people-list">${searchMarkup}</div>
          </div>
        </aside>

        <main class="center-panel">
          <div class="panel-card composer-card">
            <div class="composer-header">
              <div class="mini-avatar">${escapeHtml(initials)}</div>
              <div class="composer-title">Partager quelque chose</div>
            </div>

            <form id="composerForm">
              <textarea name="text" placeholder="Exprimez-vous... idée, pensée, photo, moment"></textarea>
              <input type="url" name="image" placeholder="Image URL optionnelle (https://...)" />

              ${state.pendingImage ? `<img class="upload-preview" src="${escapeHtml(state.pendingImage)}" alt="Preview" />` : ''}

              <div class="composer-tools">
                <label class="upload-label">
                  <input id="imageUpload" type="file" accept="image/*" />
                  Ajouter une photo
                </label>
                <button type="submit" class="primary-btn">Publier</button>
              </div>
            </form>
          </div>

          <div class="feed-wrap">${postsHtml}</div>
        </main>

        <aside class="right-panel">
          <div class="panel-card">
            <h3 class="section-title">À la une</h3>
            <ul class="trend-list">
              <li><span>#Innovation</span><strong>1.2K</strong></li>
              <li><span>#Culture</span><strong>980</strong></li>
              <li><span>#Entrepreneuriat</span><strong>820</strong></li>
              <li><span>#Design</span><strong>760</strong></li>
            </ul>
          </div>

          <div class="panel-card">
            <h3 class="section-title">Notifications</h3>
            <div class="notification-item">
              <strong>Baraza</strong>
              <span>Votre prochain post peut inspirer toute une communauté.</span>
            </div>
            <div class="notification-item">
              <strong>Suivi</strong>
              <span>Des personnes intéressées par vos idées vous suivent.</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

function renderFriendsPage() {
  const initials = (state.user.name || state.user.username || 'U').charAt(0).toUpperCase();

  const friendList = state.friends.length
    ? state.friends
        .map(
          (friend) => `
            <div class="friend-card">
              <div class="friend-meta">
                <div class="mini-avatar">${escapeHtml((friend.name || friend.username || 'U').charAt(0).toUpperCase())}</div>
                <div>
                  <strong>${escapeHtml(friend.name || friend.username)}</strong>
                  <div class="profile-handle">@${escapeHtml(friend.username)}</div>
                </div>
              </div>
              <div class="friend-actions">
                <button class="ghost-btn" data-remove-friend="${escapeHtml(friend.id)}">Supprimer</button>
              </div>
            </div>
          `
        )
        .join('')
    : '<div class="empty-state">Vous n’avez pas encore d’amis. Recherchez des personnes autour de vous.</div>';

  const requestsMarkup = state.friendRequests.length
    ? state.friendRequests
        .map(
          (user) => `
            <div class="friend-card">
              <div class="friend-meta">
                <div class="mini-avatar">${escapeHtml((user.name || user.username || 'U').charAt(0).toUpperCase())}</div>
                <div>
                  <strong>${escapeHtml(user.name || user.username)}</strong>
                  <div class="profile-handle">@${escapeHtml(user.username)}</div>
                </div>
              </div>
              <div class="friend-actions">
                <button class="primary-btn small" data-accept-friend="${escapeHtml(user.id)}">Accepter</button>
              </div>
            </div>
          `
        )
        .join('')
    : '<div class="empty-mini">Aucune demande d’amis en attente.</div>';

  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <div class="brand-mark">B</div>
          <div class="topbar-title">
            <small>Baraza</small>
            <strong>Amis</strong>
          </div>
        </div>

        <div class="topbar-actions">
          <div class="nav-pills">
            <button data-view="home">Accueil</button>
            <button class="active" data-view="friends">Amis</button>
            <button data-view="profile">Profil</button>
          </div>
          <button class="primary-btn small" id="logoutBtn">Déconnexion</button>
        </div>
      </header>

      <div class="friends-layout">
        <div class="panel-card">
          <h3 class="section-title">Mes amis</h3>
          <div class="friend-list">${friendList}</div>
        </div>

        <div class="panel-card">
          <h3 class="section-title">Demandes</h3>
          ${requestsMarkup}
        </div>
      </div>
    </div>
  `;
}

function renderProfilePage() {
  const initials = (state.user.name || state.user.username || 'U').charAt(0).toUpperCase();

  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <div class="brand-mark">B</div>
          <div class="topbar-title">
            <small>Baraza</small>
            <strong>Profil</strong>
          </div>
        </div>

        <div class="topbar-actions">
          <div class="nav-pills">
            <button data-view="home">Accueil</button>
            <button data-view="friends">Amis</button>
            <button class="active" data-view="profile">Profil</button>
          </div>
          <button class="primary-btn small" id="logoutBtn">Déconnexion</button>
        </div>
      </header>

      <div class="profile-layout">
        <div class="panel-card profile-summary">
          <div class="profile-header">
            <div class="avatar">${escapeHtml(initials)}</div>
            <div>
              <div class="profile-name">${escapeHtml(state.user.name || state.user.username)}</div>
              <div class="profile-handle">@${escapeHtml(state.user.username)}</div>
            </div>
          </div>

          <p class="profile-bio">${escapeHtml(state.user.bio || 'Aucune bio pour le moment.')}</p>

          <div class="profile-summary-grid">
            <div class="summary-box">
              <strong>${state.posts.length}</strong>
              <span>Publications</span>
            </div>
            <div class="summary-box">
              <strong>${state.friends.length}</strong>
              <span>Amis</span>
            </div>
            <div class="summary-box">
              <strong>${state.friendRequests.length}</strong>
              <span>Demandes</span>
            </div>
            <div class="summary-box">
              <strong>${state.posts.reduce((sum, post) => sum + (post.likesCount || 0), 0)}</strong>
              <span>Likes</span>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <h3 class="section-title">Modifier mon profil</h3>
          <form id="profileForm">
            <input name="name" type="text" value="${escapeHtml(state.user.name || '')}" placeholder="Nom complet" />
            <textarea name="bio" placeholder="Biographie">${escapeHtml(state.user.bio || '')}</textarea>
            <button type="submit" class="primary-btn">Enregistrer</button>
          </form>
        </div>
      </div>
    </div>
  `;
}

function render() {
  if (!state.user || !state.token) {
    renderAuth();
    return;
  }

  if (state.currentView === 'friends') {
    app.innerHTML = renderFriendsPage();
  } else if (state.currentView === 'profile') {
    app.innerHTML = renderProfilePage();
  } else {
    app.innerHTML = renderHomePage();
  }

  app.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      state.currentView = button.dataset.view;
      render();
    });
  });

  const logoutBtn = app.querySelector('#logoutBtn');
  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('barazaToken');
    state.token = '';
    state.user = null;
    state.posts = [];
    state.friends = [];
    state.friendRequests = [];
    state.searchResults = [];
    state.pendingImage = '';
    state.currentView = 'home';
    render();
  });

  const userSearch = app.querySelector('#userSearch');
  userSearch?.addEventListener('input', async (event) => {
    await searchUsers(event.target.value);
    render();
  });

  app.querySelector('#composerForm')?.addEventListener('submit', publishPost);
  app.querySelector('#profileForm')?.addEventListener('submit', saveProfile);

  app.querySelector('#imageUpload')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      state.pendingImage = String(reader.result || '');
      render();
    };
    reader.readAsDataURL(file);
  });

  app.querySelectorAll('[data-action="like"]').forEach((button) => {
    button.addEventListener('click', () => likePost(button.dataset.postId));
  });

  app.querySelectorAll('[data-action="share"]').forEach((button) => {
    button.addEventListener('click', () => sharePost(button.dataset.postId));
  });

  app.querySelectorAll('.comment-form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const comment = form.querySelector('input[name="comment"]')?.value || '';
      if (!comment.trim()) return;
      commentPost(form.dataset.postId, comment);
      form.reset();
    });
  });

  app.querySelectorAll('.friend-btn').forEach((button) => {
    button.addEventListener('click', () => requestFriend(button.dataset.userId));
  });

  app.querySelectorAll('[data-accept-friend]').forEach((button) => {
    button.addEventListener('click', () => acceptFriend(button.dataset.acceptFriend));
  });

  app.querySelectorAll('[data-remove-friend]').forEach((button) => {
    button.addEventListener('click', () => removeFriend(button.dataset.removeFriend));
  });
}

const init = async () => {
  if (state.token) {
    await loadMe();
    if (!state.user) {
      renderAuth();
      return;
    }
  }

  render();
};

window.addEventListener('storage', (event) => {
  if (event.key === 'barazaToken') {
    state.token = event.newValue || '';
    if (!state.token) {
      state.user = null;
      state.posts = [];
      state.friends = [];
      state.friendRequests = [];
      state.searchResults = [];
      state.pendingImage = '';
      state.currentView = 'home';
    }
    init();
  }
});

init();
