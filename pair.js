const { makeid } = require('./gen-id');
const express    = require('express');
const fs         = require('fs');
const path       = require('path');
const pino       = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  Browsers,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const router = express.Router();

function removeFolder(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
  }
}

router.get('/', async (req, res) => {
  const id          = makeid();
  const tempDir     = path.join(__dirname, 'temp', id);
  const phoneNumber = (req.query.number || '').replace(/\D/g, '');

  if (!phoneNumber) {
    return res.status(400).send({ error: 'Please provide a valid phone number' });
  }

  async function createSocketSession() {
    const { state, saveCreds } = await useMultiFileAuthState(tempDir);
    const logger = pino({ level: 'fatal' }).child({ level: 'fatal' });

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys:  makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal:          false,
      generateHighQualityLinkPreview: true,
      logger,
      syncFullHistory:            false,
      browser:                    Browsers.macOS('Safari'),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open') {
        await delay(5000);

        try {
          const credsPath   = path.join(tempDir, 'creds.json');
          const sessionData = fs.readFileSync(credsPath, 'utf8');
          const base64      = Buffer.from(sessionData).toString('base64');
          const sessionId   = 'NEBULA-MD~' + base64;

          // Message 1 : SESSION ID brut
          await sock.sendMessage(sock.user.id, { text: sessionId });

          // Message 2 : message de succès avec infos
          await sock.sendMessage(sock.user.id, {
            text:
              '🌌 *Nebula Bot — Session créée !*\n\n' +
              '▸ *Ne partage jamais* ton Session ID\n' +
              '▸ Rejoins notre canal WhatsApp\n' +
              '▸ Signale les bugs sur GitHub\n\n' +
              '_Powered by Nebula Bot by Dark Neon_\n\n' +
              '🔗 *Liens utiles :*\n' +
              '▸ GitHub: https://github.com/JCVERSA\n' +
              '▸ Telegram: https://t.me/Neonjce2\n' +
              '▸ WhatsApp: https://wa.me/237640143760\n' +
              '▸ YouTube: https://youtu.be/gNg2Qw5R-Q4',
            contextInfo: {
              mentionedJid: [sock.user.id],
              forwardingScore: 1000,
              isForwarded: true,
            },
          });

        } catch (err) {
          console.error('❌ Session Error:', err.message);
          await sock.sendMessage(sock.user.id, {
            text: '⚠️ Erreur: ' + (err.message.includes('rate limit')
              ? 'Serveur occupé. Réessaie plus tard.'
              : err.message),
          });
        } finally {
          await delay(1000);
          await sock.ws.close();
          removeFolder(tempDir);
          console.log('✅ Session complétée pour', sock.user.id);
          process.exit();
        }

      } else if (connection === 'close' &&
                 lastDisconnect?.error?.output?.statusCode !== 401) {
        console.log('🔁 Reconnexion...');
        await delay(10);
        createSocketSession();
      }
    });

    if (!sock.authState.creds.registered) {
      await delay(1500);
      const pairingCode = await sock.requestPairingCode(phoneNumber);
      if (!res.headersSent) {
        return res.send({ code: pairingCode });
      }
    }
  }

  try {
    await createSocketSession();
  } catch (err) {
    console.error('🚨 Fatal Error:', err.message);
    removeFolder(tempDir);
    if (!res.headersSent) {
      res.status(500).send({ code: 'Service Unavailable. Try again later.' });
    }
  }
});

module.exports = router;
