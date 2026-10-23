const app = document.getElementById('app');

const state = {
  token: localStorage.getItem('barazaToken') || '',
  user: null,
  posts: []
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
    await loadPosts();
  } catch {
    localStorage.removeItem('barazaToken');
    state.token = '';
    state.user = null;
  }
}

async function loadPosts() {
  if (!state.token) {
    state.posts = [];
    return;
  }

  const posts = await apiFetch('/api/posts');
  state.posts = Array.isArray(posts) ? posts : [];
  render();
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
    await loadPosts();
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
    await loadPosts();
  } catch (error) {
    errorNode.textContent = error.message;
  }
}

async function publishPost(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const text = form.text.value.trim();
  const image = form.image.value.trim();

  if (!text && !image) {
    form.querySelector('.form-error')?.remove();
    return;
  }

  try {
    const result = await apiFetch('/api/posts', {
      method: 'POST',
      body: { text, image }
    });

    state.posts = [result, ...state.posts];
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

function renderAuth() {
  app.innerHTML = `
    <div class="auth-card">
      <div class="auth-box">
        <h2>Baraza</h2>
        <p class="auth-tagline">Partager des idées, des photos et des moments.</p>

        <div class="tabs">
          <button class="active" data-mode="login">Connexion</button>
          <button data-mode="register">Créer un compte</button>
        </div>

        <form id="loginForm" class="auth-form">
          <input name="username" type="text" placeholder="Nom d'utilisateur" required />
          <input name="password" type="password" placeholder="Mot de passe" required />
          <button class="primary-btn" type="submit">Se connecter</button>
          <div class="form-error"></div>
        </form>

        <form id="registerForm" class="auth-form hidden">
          <input name="name" type="text" placeholder="Votre nom complet" required />
          <input name="username" type="text" placeholder="Nom d'utilisateur" required />
          <input name="password" type="password" placeholder="Mot de passe (4+ caractères)" required />
          <button class="primary-btn" type="submit">Créer mon compte</button>
          <div class="form-error"></div>
        </form>
      </div>
    </div>
  `;

  const tabs = app.querySelectorAll('.tabs button');
  const loginForm = app.querySelector('#loginForm');
  const registerForm = app.querySelector('#registerForm');

  tabs.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode;
      tabs.forEach((btn) => btn.classList.toggle('active', btn === button));
      loginForm.classList.toggle('hidden', mode !== 'login');
      registerForm.classList.toggle('hidden', mode !== 'register');
    });
  });

  loginForm.addEventListener('submit', loginUser);
  registerForm.addEventListener('submit', registerUser);
}

function render() {
  if (!state.user || !state.token) {
    renderAuth();
    return;
  }

  const postsHtml = state.posts.length
    ? state.posts
        .map((post) => {
          const author = post.author || {};
          const commentsHtml = (post.comments || [])
            .map(
              (comment) => `
                <div class="comment-item">
                  <strong>${escapeHtml(comment.author?.username || 'Utilisateur')}</strong>
                  <span>${escapeHtml(comment.text || '')}</span>
                </div>
              `
            )
            .join('');

          const sharedMarkup = post.sharedFrom
            ? `<div class="shared-badge">Partagé</div>`
            : '';

          return `
            <article class="post-card" data-post-id="${escapeHtml(post.id)}">
              <div class="post-head">
                <div class="avatar">${escapeHtml((author.name || author.username || 'U').charAt(0).toUpperCase())}</div>
                <div class="post-meta">
                  <div class="post-name">${escapeHtml(author.name || author.username || 'Utilisateur')}</div>
                  <div class="post-time">${escapeHtml(formatRelativeTime(post.createdAt))}</div>
                </div>
              </div>

              ${sharedMarkup}

              <div class="post-body">${escapeHtml(post.text || '')}</div>

              ${post.image ? `<img class="post-image" src="${escapeHtml(post.image)}" alt="Image de publication" />` : ''}

              <div class="post-actions">
                <button class="like-btn ${post.likedByMe ? 'active' : ''}" data-action="like" data-post-id="${escapeHtml(post.id)}">${post.likedByMe ? '💛 Aimé' : '🤍 Aimer'} (${post.likesCount || 0})</button>
                <button class="share-btn" data-action="share" data-post-id="${escapeHtml(post.id)}">🔁 Partager (${post.sharesCount || 0})</button>
              </div>

              <div class="comments">
                ${commentsHtml || '<div class="comment-item"><strong>Baraza</strong><span>Aucun commentaire pour le moment.</span></div>'}
              </div>

              <form class="comment-form" data-post-id="${escapeHtml(post.id)}">
                <input name="comment" placeholder="Écrire un commentaire..." />
                <button type="submit" class="comment-btn">Commenter</button>
              </form>
            </article>
          `;
        })
        .join('')
    : '<div class="empty-feed">Aucune publication pour le moment. Lancez la première idée !</div>';

  const initials = (state.user.name || state.user.username || 'U').charAt(0).toUpperCase();

  app.innerHTML = `
    <div class="baraza-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">B</div>
          <h1>Baraza</h1>
        </div>

        <div class="user-pill">
          <div class="avatar">${escapeHtml(initials)}</div>
          <div class="user-name">${escapeHtml(state.user.name || state.user.username)}</div>
          <button class="outline-btn" id="logoutBtn">Déconnexion</button>
        </div>
      </header>

      <div class="layout">
        <aside class="sidebar">
          <div class="side-card">
            <h3>Statut</h3>
            <div class="stats">
              <div class="stat-box">
                <span>Publications</span>
                <strong>${state.posts.length}</strong>
              </div>
              <div class="stat-box">
                <span>J’aime</span>
                <strong>${state.posts.reduce((sum, post) => sum + (post.likesCount || 0), 0)}</strong>
              </div>
            </div>
          </div>

          <div class="side-card">
            <h3>À propos</h3>
            <p style="color: var(--muted); line-height: 1.6; margin: 0;">
              Partagez des idées, des moments et des images avec votre communauté Baraza.
            </p>
          </div>
        </aside>

        <main class="feed">
          <form class="composer" id="composerForm">
            <textarea name="text" placeholder="Qu'avez-vous envie de partager aujourd'hui ?"></textarea>
            <input name="image" type="url" placeholder="Lien image optionnel (https://...)" />
            <div class="composer-actions">
              <button type="submit" class="primary-btn">Publier</button>
            </div>
          </form>

          <div class="posts">
            ${postsHtml}
          </div>
        </main>
      </div>
    </div>
  `;

  app.querySelector('#logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('barazaToken');
    state.token = '';
    state.user = null;
    state.posts = [];
    render();
  });

  app.querySelector('#composerForm')?.addEventListener('submit', publishPost);

  app.querySelectorAll('[data-action="like"]').forEach((button) => {
    button.addEventListener('click', () => likePost(button.dataset.postId));
  });

  app.querySelectorAll('[data-action="share"]').forEach((button) => {
    button.addEventListener('click', () => sharePost(button.dataset.postId));
  });

  app.querySelectorAll('.comment-form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = form.comment.value.trim();
      if (!text) return;
      commentPost(form.dataset.postId, text);
      form.reset();
    });
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

init();

window.addEventListener('storage', (event) => {
  if (event.key === 'barazaToken') {
    state.token = event.newValue || '';
    if (!state.token) {
      state.user = null;
      state.posts = [];
    }
    init();
  }
});

