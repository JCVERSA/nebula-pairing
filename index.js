const express = require('express');
const app = express();
__path = process.cwd();
const bodyParser = require("body-parser");
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
  console.log(`
🌌 Nebula Bot — Session Generator
🚀 Serveur démarré sur le port ${PORT}
📡 http://localhost:${PORT}
💬 by Dark Neon
  `);
});

module.exports = app;
