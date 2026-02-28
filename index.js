const express = require('express');
const path    = require('path');
const app     = express();

const pairCode = require('./pair');

const PORT = process.env.PORT || 8001;
global.__path = process.cwd();

require('events').EventEmitter.defaultMaxListeners = 500;

// Routes
app.use('/code', pairCode);
app.use('/', (req, res) => res.sendFile(path.join(__path, 'pair.html')));

app.listen(PORT, () => {
  console.log('\n🌌 ================================');
  console.log('   Nebula Bot — Pairing Server');
  console.log('   by Dark Neon');
  console.log('================================');
  console.log('🚀 Port : ' + PORT);
  console.log('================================\n');
});

module.exports = app;
