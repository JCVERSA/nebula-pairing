const { makeid } = require('./gen-id');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');

const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();

    async function NEBULA_QR_CODE() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);

        try {
            let sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                // FIX BUG 1 : Chrome au lieu de macOS Desktop
                browser: Browsers.ubuntu("Chrome"),
            });

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;

                if (qr) await res.end(await QRCode.toBuffer(qr));

                if (connection == "open") {
                    await delay(5000);
                    let rf = __dirname + `/temp/${id}/creds.json`;

                    try {
                        const mega_url = await upload(fs.createReadStream(rf), `${sock.user.id}.json`);
                        const string_session = mega_url.replace('https://mega.nz/file/', '');
                        let md = "nebula~" + string_session;

                        let code = await sock.sendMessage(sock.user.id, { text: md });

                        let desc = `*Hey there, Nebula Bot User!* 👋🏻\n\nThanks for using *Nebula Bot* — your session has been successfully created!\n\n🔐 *Session ID:* Sent above\n⚠️ *Keep it safe!* Do NOT share this ID with anyone.\n\n——————\n\n*✅ Rejoins notre groupe :*\nhttps://chat.whatsapp.com/EqrRF0FvlTWLcgJR91RfCA\n\n*💬 Telegram :*\nhttps://t.me/Kitagawa_ayanokoji\n\n*📞 Support :*\nhttps://wa.me/237640143760\n\n——————\n\n> *© Powered by Dark Neon — Nebula Bot*`;

                        await sock.sendMessage(sock.user.id, {
                            text: desc,
                            contextInfo: {
                                externalAdReply: {
                                    // FIX BUG 3 : title corrigé
                                    title: "ɴᴇʙᴜʟᴀ ʙᴏᴛ ✅",
                                    body: "by Dark Neon",
                                    thumbnailUrl: "https://files.catbox.moe/bqs70b.jpg",
                                    sourceUrl: "https://chat.whatsapp.com/EqrRF0FvlTWLcgJR91RfCA",
                                    mediaType: 1,
                                    renderLargerThumbnail: true
                                }
                            }
                        }, { quoted: code });

                    } catch (e) {
                        // Fallback sans Mega
                        try {
                            const credsData = fs.readFileSync(rf, 'utf-8');
                            const base64 = Buffer.from(credsData).toString('base64');
                            await sock.sendMessage(sock.user.id, {
                                text: `🌌 *Nebula Bot Session*\n\nnebula~${base64}\n\n⚠️ Ne partage pas ce code.`
                            });
                        } catch (e2) {
                            console.error('Fallback error:', e2.message);
                        }
                    }

                    await delay(2000);
                    try { sock.ws.close(); } catch (e) {}
                    removeFile('./temp/' + id);
                    console.log(`✅ Session QR envoyée à ${sock.user.id}`);
                    // FIX BUG 2 : process.exit() supprimé

                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode != 401) {
                    await delay(1000);
                    NEBULA_QR_CODE();
                }
            });

        } catch (err) {
            console.log("Erreur QR code:", err.message);
            removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.send({ error: "❗ Service Unavailable" });
            }
        }
    }

    await NEBULA_QR_CODE();
});

// FIX BUG 2 : setInterval process.exit() toutes les 3min supprimé

module.exports = router;
