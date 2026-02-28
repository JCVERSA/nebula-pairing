# 🌌 Nebula Bot — Pairing Server

Serveur de connexion WhatsApp pour Nebula Bot.

---

## 📁 Structure

```
nebula-pairing/
├── server.js      ← Serveur Node.js (Baileys + Express)
├── index.html     ← Site web de pairing
├── package.json   ← Dépendances
└── session/       ← Créé automatiquement (credentials WhatsApp)
```

---

## 🚀 Déploiement sur Render (gratuit)

### Étape 1 — Prépare les fichiers
1. Crée un dossier `nebula-pairing` sur ton PC
2. Mets les 3 fichiers dedans : `server.js`, `index.html`, `package.json`
3. Crée un repo GitHub avec ces fichiers

### Étape 2 — Déploie sur Render
1. Va sur **render.com** → créer un compte gratuit
2. Clique **New → Web Service**
3. Connecte ton repo GitHub
4. Configure :
   - **Name** : nebula-pairing
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `node server.js`
   - **Plan** : Free
5. Clique **Deploy**

### Étape 3 — Utiliser le site
1. Render te donne une URL : `https://nebula-pairing.onrender.com`
2. Visite cette URL
3. Entre ton numéro WhatsApp (ex: `33612345678`)
4. Clique **Generate Pair Code**
5. Entre le code dans WhatsApp → Appareils liés → Lier avec numéro
6. Tu reçois le SESSION ID par message WhatsApp ✅

### Étape 4 — Connecter le bot
Ouvre `config.js` de ton Nebula Bot et ajoute :
```js
sessionId: 'COLLE_TON_SESSION_ID_ICI',
```

---

## ⚠️ Notes importantes

- Le serveur **reste connecté en permanence** sur Render
- Sur le plan gratuit Render, le serveur se met en veille après 15 min d'inactivité
  → Solution : utilise **UptimeRobot** (gratuit) pour le ping toutes les 10 min
- Ne partage **jamais** ton SESSION ID

---

## 🔧 UptimeRobot (pour garder le serveur actif)

1. Va sur **uptimerobot.com** → créer un compte
2. **New Monitor** → HTTP(s)
3. URL : `https://ton-serveur.onrender.com/status`
4. Interval : 5 minutes
5. Save ✅
