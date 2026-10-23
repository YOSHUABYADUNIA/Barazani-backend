* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
body { font-family: 'Outfit', system-ui, sans-serif; background: #0d1830; color: #f0e6d2; min-height: 100vh; }
#app { max-width: 480px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; background: #14233c; position: relative; }
.hidden { display: none !important; }

/* Auth */
.auth { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 32px 24px; gap: 16px; }
.auth h1 { text-align: center; font-size: 36px; letter-spacing: .15em; color: #d4a017; }
.auth p.tag { text-align: center; color: #9fb0c8; font-size: 13px; margin-bottom: 12px; }
.tabs { display: flex; background: #0d1830; border-radius: 12px; padding: 4px; margin-bottom: 8px; }
.tabs button { flex: 1; padding: 10px; border: none; background: transparent; color: #9fb0c8; font-weight: 700; border-radius: 9px; cursor: pointer; font-size: 14px; }
.tabs button.active { background: #d4a017; color: #14233c; }
input, textarea { width: 100%; padding: 13px 14px; border-radius: 10px; border: 1px solid #2a3a55; background: #0d1830; color: #f0e6d2; font-size: 15px; outline: none; font-family: inherit; }
input:focus, textarea:focus { border-color: #d4a017; }
.btn { padding: 13px; border: none; border-radius: 10px; background: linear-gradient(135deg, #d4a017, #b8860b); color: #14233c; font-weight: 800; font-size: 15px; cursor: pointer; letter-spacing: .02em; }
.btn.small { padding: 9px 12px; font-size: 13px; }
.btn.ghost { background: #2a3a55; color: #f0e6d2; }
.btn.danger { background: #c0392b; color: #fff; }
.err { color: #e74c3c; font-size: 13px; text-align: center; min-height: 18px; }

/* Header */
.header { padding: 14px 16px; background: #0d1830; border-bottom: 1px solid #2a3a55; display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 10; }
.header h2 { font-size: 17px; color: #d4a017; letter-spacing: .08em; flex: 1; }
.back { background: none; border: none; color: #f0e6d2; font-size: 20px; cursor: pointer; padding: 4px 8px; }
.avatar { width: 40px; height: 40px; border-radius: 50%; background: #2a3a55; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #d4a017; flex: none; overflow: hidden; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }

/* Lists */
.list { flex: 1; overflow-y: auto; padding: 8px 0; }
.row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #1a2740; }
.row:hover { background: #1a2740; }
.row .info { flex: 1; min-width: 0; }
.row .name { font-weight: 700; font-size: 15px; }
.row .sub { font-size: 12px; color: #9fb0c8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge { background: #c0392b; color: #fff; border-radius: 10px; padding: 2px 8px; font-size: 11px; font-weight: 700; }
.row button { flex: none; padding: 7px 12px; border-radius: 14px; border: none; font-weight: 700; font-size: 12px; cursor: pointer; }
.add { background: #d4a017; color: #14233c; }
.accept { background: #27ae60; color: #fff; }
.pending { background: #2a3a55; color: #9fb0c8; }

/* Search */
.searchbar { padding: 12px 16px; background: #0d1830; }

/* Chat */
.chat { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: #0d1830; }
.msg { max-width: 78%; padding: 9px 12px; border-radius: 14px; font-size: 14px; word-wrap: break-word; white-space: pre-wrap; }
.msg.me { align-self: flex-end; background: #d4a017; color: #14233c; border-bottom-right-radius: 4px; }
.msg.them { align-self: flex-start; background: #2a3a55; color: #f0e6d2; border-bottom-left-radius: 4px; }
.msg img { max-width: 200px; border-radius: 8px; display: block; margin-top: 4px; }
.msg .play { background: rgba(0,0,0,.15); border: none; border-radius: 12px; padding: 6px 12px; color: inherit; font-size: 12px; cursor: pointer; margin-top: 4px; }
.composer { display: flex; gap: 8px; padding: 10px 12px; background: #14233c; border-top: 1px solid #2a3a55; align-items: center; }
.composer input { flex: 1; }
.iconbtn { width: 42px; height: 42px; border-radius: 50%; border: none; background: #2a3a55; color: #f0e6d2; font-size: 18px; cursor: pointer; flex: none; display: flex; align-items: center; justify-content: center; }
.iconbtn.rec { background: #c0392b; animation: pulse 1s infinite; }
@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }

/* Profile */
.profile { padding: 20px 16px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px; }
.profile .big-avatar { width: 80px; height: 80px; border-radius: 50%; background: #2a3a55; align-self: center; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 800; color: #d4a017; overflow: hidden; }
.profile .big-avatar img { width: 100%; height: 100%; object-fit: cover; }
.section { font-size: 12px; color: #9fb0c8; text-transform: uppercase; letter-spacing: .08em; margin-top: 8px; }
.empty { text-align: center; color: #9fb0c8; padding: 40px 20px; font-size: 14px; }

/* Bottom nav */
.nav { display: flex; background: #0d1830; border-top: 1px solid #2a3a55; }
.nav button { flex: 1; padding: 10px 0 8px; border: none; background: none; color: #9fb0c8; font-size: 11px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.nav button .ic { font-size: 20px; }
.nav button.active { color: #d4a017; }

/* Feed */
.feed-creator { background: #0d1830; padding: 12px 16px; border-bottom: 1px solid #2a3a55; }
.feed-creator textarea { min-height: 80px; resize: vertical; }
.feed-tools { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; }
.post-preview { margin-top: 10px; border-radius: 12px; overflow: hidden; border: 1px solid #2a3a55; background: #14233c; }
.post-preview img { display: block; max-height: 220px; width: 100%; object-fit: cover; }
.link-btn { border: none; background: transparent; color: #d4a017; font-weight: 700; cursor: pointer; padding: 8px 12px; }
.post-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.post-card { border-bottom: 1px solid #1a2740; padding: 14px 16px; }
.post-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.post-meta { flex: 1; min-width: 0; }
.post-name { font-weight: 700; }
.post-sub { color: #9fb0c8; font-size: 12px; }
.post-body { color: #f0e6d2; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.post-image { width: 100%; margin-top: 10px; border-radius: 12px; display: block; }
.post-visibility { margin-top: 10px; display: inline-block; background: #2a3a55; color: #d4a017; border-radius: 999px; padding: 4px 8px; font-size: 11px; font-weight: 700; }
.post-reactions { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.react-btn { flex: 1; min-width: 80px; border: 1px solid #2a3a55; background: #0d1830; color: #f0e6d2; border-radius: 999px; padding: 8px 10px; font-weight: 700; cursor: pointer; }
.react-btn.active { background: rgba(212,160,23,.15); color: #d4a017; border-color: rgba(212,160,23,.5); }
.post-comments { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.comment-row { display: flex; flex-direction: column; gap: 3px; background: #0d1830; border: 1px solid #2a3a55; border-radius: 10px; padding: 8px 10px; font-size: 12px; }
.comment-row strong { color: #d4a017; }
.comment-row span { color: #f0e6d2; }
.comment-empty { color: #9fb0c8; font-size: 12px; }
.comment-form { display: flex; gap: 8px; margin-top: 4px; }
.comment-form input { flex: 1; }
.public-feed { padding-top: 0; }

/* Admin */
.admin-panel { padding: 16px; }
.admin-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
.admin-card { background: #0d1830; border: 1px solid #2a3a55; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.admin-card span { color: #9fb0c8; font-size: 12px; }
.admin-card strong { font-size: 24px; color: #d4a017; }
.admin-list h3 { margin-bottom: 8px; color: #d4a017; }
.role-badge { padding: 6px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.role-badge.admin { background: rgba(212,160,23,.15); color: #d4a017; }
.role-badge.user { background: rgba(67,118,230,.15); color: #8ec5ff; }
.admin-row { padding: 10px 0; }

@media (max-width: 420px) {
  .feed-tools { flex-direction: column; align-items: stretch; }
  .feed-tools .btn { width: 100%; }
  .comment-form { flex-direction: column; }
  .comment-form .btn { width: 100%; }
}



































































































































































































































































