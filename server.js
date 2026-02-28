/**
 * Nebula Bot — Pairing Server (FIXED VERSION)
 */

const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const zlib = require("zlib");
const pino = require("pino");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/status", (req, res) => res.send("OK"));

let currentPairNumber = null;
let sock = null;
let saveCreds = null;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startBaileys(number) {
  if (sock) {
    try {
      sock.ev.removeAllListeners();
      await sock.logout();
    } catch {}
  }

  const { state, saveCreds: _saveCreds } =
    await useMultiFileAuthState("./session");

  saveCreds = _saveCreds;

  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection } = update;

    if (connection === "open") {
      console.log("Connexion ouverte");

      await delay(3000);

      if (!sock?.user?.id) {
        console.log("Utilisateur non prêt");
        return;
      }

      const credsPath = path.join(__dirname, "session", "creds.json");
      if (!fs.existsSync(credsPath)) {
        console.log("creds.json introuvable");
        return;
      }

      const creds = await fs.readFile(credsPath);
      const compressed = zlib.gzipSync(creds);
      const base64 = compressed.toString("base64");
      const SESSION_ID = `NebulaBot!${base64}`;

      // 🔥 FIX PRINCIPAL ICI
      let recipient;

      if (currentPairNumber) {
        const digits = currentPairNumber.replace(/\D/g, "");
        recipient = `${digits}@s.whatsapp.net`;
      } else {
        recipient = sock.user.id; // format déjà correct
      }

      try {
        console.log("Envoi du SESSION_ID à :", recipient);

        await sock.sendMessage(recipient, {
          text: `✅ Connexion réussie !

Voici votre SESSION_ID :

${SESSION_ID}`,
        });

        console.log("SESSION_ID envoyé avec succès");
      } catch (err) {
        console.log("Erreur envoi :", err?.message || err);
      }
    }
  });
}

app.post("/pair", async (req, res) => {
  try {
    const number = req.body.number;
    if (!number)
      return res.status(400).json({ error: "Numéro requis" });

    const clean = number.replace(/\D/g, "");
    currentPairNumber = clean;

    await startBaileys(clean);

    const code = await sock.requestPairingCode(clean);

    return res.json({ pairingCode: code });
  } catch (err) {
    console.log("Erreur pairing :", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

app.listen(PORT, () => {
  console.log("Serveur lancé sur port", PORT);
});