const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  Browsers,
  makeCacheableSignalKeyStore,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const { upload } = require('./mega');

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
  const id = makeid();
  let num = req.query.number;

  async function NEBULA_PAIR_CODE() {
    const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

    try {
      let sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        syncFullHistory: false,
        browser: Browsers.macOS("Safari")
      });

      if (!sock.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, '');
        const code = await sock.requestPairingCode(num);
        if (!res.headersSent) {
          await res.send({ code });
        }
      }

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;

        if (connection == "open") {
          await delay(5000);

          let rf = __dirname + `/temp/${id}/creds.json`;

          try {
            // ── Envoi via Mega.nz ──
            const mega_url = await upload(fs.createReadStream(rf), `${sock.user.id}.json`);
            const string_session = mega_url.replace('https://mega.nz/file/', '');
            let sessionId = "nebula~" + string_session;

            // ── Message SESSION_ID ──
            let code = await sock.sendMessage(sock.user.id, { text: sessionId });

            // ── Message de bienvenue ──
            let desc = `🌌 *Nebula Bot — Session créée !* 🌌

✅ Ton session a été générée avec succès !

🔐 *SESSION ID :* Envoyé ci-dessus
⚠️ *Ne le partage JAMAIS avec personne.*

──────────────────

📲 *Rejoins notre groupe :*
https://chat.whatsapp.com/EqrRF0FvlTWLcgJR91RfCA

💬 *Telegram :*
https://t.me/Kitagawa_ayanokoji

📞 *Support :*
https://wa.me/237640143760

──────────────────

> *© Powered by Dark Neon — Nebula Bot*`;

            await sock.sendMessage(sock.user.id, {
              text: desc,
              contextInfo: {
                externalAdReply: {
                  title: "ɴᴇʙᴜʟᴀ ʙᴏᴛ",
                  body: "by Dark Neon",
                  thumbnailUrl: "https://files.catbox.moe/bqs70b.jpg",
                  sourceUrl: "https://chat.whatsapp.com/EqrRF0FvlTWLcgJR91RfCA",
                  mediaType: 1,
                  renderLargerThumbnail: true
                }
              }
            }, { quoted: code });

          } catch (e) {
            // Fallback : envoi base64 direct si Mega échoue
            try {
              const credsData = fs.readFileSync(rf, 'utf-8');
              const base64Creds = Buffer.from(credsData).toString('base64');
              await sock.sendMessage(sock.user.id, {
                text: `🌌 *Nebula Bot — Session ID (backup)*\n\nnebula~${base64Creds}\n\n⚠️ Ne partage pas ce code.`
              });
            } catch (e2) {
              console.error('Backup send failed:', e2.message);
            }
          }

          await delay(2000);
          await sock.ws.close();
          await removeFile('./temp/' + id);
          console.log(`✅ Session générée pour ${sock.user.id}`);
          await delay(10);
          process.exit();

        } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode != 401) {
          await delay(10);
          NEBULA_PAIR_CODE();
        }
      });

    } catch (err) {
      console.log("Erreur — redémarrage:", err.message);
      await removeFile('./temp/' + id);
      if (!res.headersSent) {
        await res.send({ code: "❗ Service Unavailable" });
      }
    }
  }

  return await NEBULA_PAIR_CODE();
});

module.exports = router;
