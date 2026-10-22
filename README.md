# BARAZANI Online — Serveur backend

Application sociale en ligne : comptes utilisateurs, profils, recherche d'amis,
messagerie (texte, voix, photos). L'APK est le client ; ce serveur doit être
hébergé et accessible par les téléphones.

## Démarrage rapide

```bash
npm install
node server.js
# Serveur sur http://0.0.0.0:3000
```

- Les données sont sauvegardées dans `data.json` (base JSON).
- Changez le secret JWT : `JWT_SECRET=un_long_secret_aleatoire node server.js`
- Port personnalisé : `PORT=8080 node server.js`

## Déploiement

### Option A — Sur un VPS / serveur personnel (recommandé)
1. Copiez ce dossier sur le serveur (Node.js 18+ requis).
2. `npm install && node server.js` (ou utilisez `pm2` pour le garder en ligne).
3. Utilisez un nom de domaine + HTTPS (Let's Encrypt / nginx) pour la production.
4. Dans l'APK, saisissez l'adresse, ex. `https://barazani.exemple.com`.

### Option B — Hébergement gratuit (Render / Railway / Fly.io)
- Créez un compte, importez ce dossier, la plateforme détecte Node.js.
- Commande de build : `npm install` — Commande de démarrage : `node server.js`.
- Ajoutez la variable d'environnement `JWT_SECRET`.
- L'URL fournie (ex. `https://barazani.onrender.com`) est à saisir dans l'APK.

### Option C — Réseau local (démo)
- Lancez `node server.js` sur un ordinateur du même Wi-Fi.
- Dans l'APK, saisissez `http://<IP-de-l-ordinateur>:3000` (ex. `http://192.168.1.10:3000`).
- Le téléphone et l'ordinateur doivent être sur le même réseau.

## API (résumé)
- `POST /api/register` / `POST /api/login` → `{token, user}`
- `GET/PUT/DELETE /api/me` (profil : nom, bio, avatar, mot de passe ; suppression du compte)
- `GET /api/users/search?q=…` — recherche d'utilisateurs
- `POST /api/friends/request` / `accept` / `remove` — système d'amis
- `GET /api/messages/:friendId` / `POST /api/messages` — messages (type: text|voice|image)
- WebSocket `ws://…/ws?token=…` — notifications en temps réel

## Sécurité
- Changez `JWT_SECRET` en production.
- Utilisez HTTPS pour éviter l'envoi de mots de passe en clair.
- Pour plus de 100 utilisateurs, migrez `data.json` vers PostgreSQL/MySQL.
