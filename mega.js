const { Storage } = require('megajs');

// ─── Credentials via variables d'environnement Render ───
// Sur Render : Settings → Environment → Add Variable
// MEGA_EMAIL    → ton email Mega.nz
// MEGA_PASSWORD → ton mot de passe Mega.nz
const email = process.env.MEGA_EMAIL;
const pw    = process.env.MEGA_PASSWORD;

const upload = (fileStream, fileName) => {
  return new Promise((resolve, reject) => {
    if (!email || !pw) {
      return reject(new Error('MEGA_EMAIL et MEGA_PASSWORD non configurés dans les variables d\'environnement Render.'));
    }

    const storage = new Storage({ email, password: pw });

    storage.on('ready', () => {
      const upload = storage.upload({ name: fileName, allowUploadBuffering: true });
      fileStream.pipe(upload);

      upload.on('complete', (file) => {
        file.link((err, url) => {
          if (err) {
            storage.close();
            return reject(err);
          }
          storage.close();
          resolve(url);
        });
      });

      upload.on('error', (err) => {
        storage.close();
        reject(err);
      });
    });

    storage.on('error', (err) => {
      reject(err);
    });
  });
};

module.exports = { upload };
