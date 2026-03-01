const express = require('express');
const app = express();
__path = process.cwd();
const bodyParser = require("body-parser");

// FIX BUG 4 : parseInt pour le PORT
const PORT = parseInt(process.env.PORT) || 8000;

let server = require('./qr'),
    code   = require('./pair');

require('events').EventEmitter.defaultMaxListeners = 500;

app.use('/server', server);
app.use('/code',   code);
app.use('/pair', async (req, res) => res.sendFile(__path + '/pair.html'));
app.use('/qr',   async (req, res) => res.sendFile(__path + '/qr.html'));
app.use('/',     async (req, res) => res.sendFile(__path + '/main.html'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌌 Nebula Bot — Session Generator\n🚀 Port: ${PORT}\n💬 by Dark Neon\n`);
});

// FIX BUG 5 : Keep-alive pour Render Free (ping toutes les 4 min)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
    setInterval(() => {
        require('https').get(RENDER_URL, (res) => {
            console.log(`♻️ Keep-alive ping → ${res.statusCode}`);
        }).on('error', () => {});
    }, 4 * 60 * 1000);
    console.log(`🔔 Keep-alive activé → ${RENDER_URL}`);
}

module.exports = app;
