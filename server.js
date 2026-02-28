/**
 * Nebula Bot — Pairing Server
 * by Dark Neon
 *
 * Ce serveur :
 * 1. Sert le site web de pairing
 * 2. Génère un Pair Code via Baileys
 * 3. Une fois connecté, envoie le SESSION ID par message WhatsApp
 * 4. Reste connecté en permanence comme appareil lié
 */

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const pino     = require('pino');
const qrcode   = require('qrcode');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Logger silencieux ───────────────────────────────────────────────────────
const logger = pino({ level: 'silent' });

// ─── État global ─────────────────────────────────────────────────────────────
let sock           = null;
let currentQR      = null;
let isConnected    = false;
let sessionSent    = false;   // Pour n'envoyer le SESSION ID qu'une seule fois

// ─── Dossier session ─────────────────────────────────────────────────────────
const SESSION_DIR = path.join(__dirname, 'session');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// ─── Générer le SESSION ID depuis les credentials ────────────────────────────
function generateSessionId() {
  try {
    const credsPath = path.join(SESSION_DIR, 'creds.json');
    if (!fs.existsSync(credsPath)) return null;
    const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
    // Encoder les credentials en base64 pour le SESSION ID
    const sessionData = Buffer.from(JSON.stringify(creds)).toString('base64');
    return sessionData;
  } catch (e) {
    console.error('[Session] Error generating session ID:', e.message);
    return null;
  }
}

// ─── Envoyer le SESSION ID par message WhatsApp ──────────────────────────────
async function sendSessionId(jid) {
  if (sessionSent) return;
  sessionSent = true;

  try {
    const sessionId = generateSessionId();
    if (!sessionId) {
      console.error('[Session] Could not generate session ID');
      return;
    }

    const message =
`🌌 *Nebula Bot — Session ID*

✅ Connexion réussie ! Voici ton SESSION ID :

\`\`\`
${sessionId}
\`\`\`

📋 *Comment l'utiliser :*
1. Ouvre \`config.js\` de ton Nebula Bot
2. Trouve la ligne \`sessionId\`
3. Colle ce code

⚠️ *Ne partage jamais ce code avec personne !*

> _Nebula Bot by Dark Neon_`;

    await sock.sendMessage(jid, { text: message });
    console.log(`[Session] ✅ SESSION ID sent to ${jid}`);
  } catch (e) {
    console.error('[Session] Error sending session ID:', e.message);
  }
}

// ─── Connexion Baileys ───────────────────────────────────────────────────────
async function startBaileys(phoneNumber = null) {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  // Générer le Pair Code si un numéro est fourni
  if (phoneNumber && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`[Pairing] Code generated: ${code}`);
        // Stocker le code pour le renvoyer au site
        global.pendingPairCode = code;
      } catch (e) {
        console.error('[Pairing] Error generating pair code:', e.message);
        global.pendingPairCodeError = e.message;
      }
    }, 3000);
  }

  // QR Code (fallback)
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = await qrcode.toDataURL(qr);
      console.log('[QR] New QR code generated');
    }

    if (connection === 'open') {
      isConnected = true;
      currentQR = null;
      console.log('[Bot] ✅ Connected to WhatsApp!');
      console.log(`[Bot] Number: ${sock.user?.id?.split(':')[0]}`);

      // Envoyer le SESSION ID au numéro connecté
      if (!sessionSent) {
        const jid = sock.user?.id?.replace(/:\d+/, '') + '@s.whatsapp.net';
        setTimeout(() => sendSessionId(jid), 2000);
      }
    }

    if (connection === 'close') {
      isConnected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;

      console.log(`[Bot] Disconnected (code: ${code}) — Reconnect: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(() => startBaileys(), 5000);
      } else {
        // Supprimé les credentials si déconnecté manuellement
        console.log('[Bot] Logged out — clearing session');
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        fs.mkdirSync(SESSION_DIR);
        sessionSent = false;
        global.pendingPairCode = null;
        setTimeout(() => startBaileys(), 3000);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

// ─── Routes Express ──────────────────────────────────────────────────────────

// Servir le site HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Générer le Pair Code
app.get('/pair', async (req, res) => {
  try {
    const number = req.query.number?.replace(/[^0-9]/g, '');

    if (!number || number.length < 7) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    // Reset l'état
    global.pendingPairCode = null;
    global.pendingPairCodeError = null;
    sessionSent = false;

    // Redémarrer Baileys avec ce numéro
    if (sock) {
      try { await sock.end(); } catch (e) {}
      sock = null;
    }

    // Supprimer la session existante pour forcer un nouveau pairing
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      fs.mkdirSync(SESSION_DIR);
    }

    // Démarrer avec le numéro
    await startBaileys(number);

    // Attendre le code (max 15 secondes)
    let waited = 0;
    while (!global.pendingPairCode && !global.pendingPairCodeError && waited < 15000) {
      await new Promise(r => setTimeout(r, 500));
      waited += 500;
    }

    if (global.pendingPairCodeError) {
      return res.status(500).json({ error: global.pendingPairCodeError });
    }

    if (!global.pendingPairCode) {
      return res.status(504).json({ error: 'Timeout — try again' });
    }

    res.json({ code: global.pendingPairCode });

  } catch (e) {
    console.error('[/pair] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Obtenir le QR Code
app.get('/qr', (req, res) => {
  if (currentQR) {
    res.json({ qr: currentQR });
  } else {
    res.status(404).json({ error: 'No QR code available' });
  }
});

// Status du serveur
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    number: isConnected ? sock?.user?.id?.split(':')[0] : null
  });
});

// ─── Démarrage ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌌 Nebula Pairing Server`);
  console.log(`🚀 Running on port ${PORT}`);
  console.log(`🌐 Visit: http://localhost:${PORT}\n`);
});

// Démarrer Baileys au lancement (si session existe déjà)
startBaileys().catch(console.error);
