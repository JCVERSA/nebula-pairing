const { Storage } = require('megajs');

// Variables d'environnement à configurer sur Render :
// MEGA_EMAIL    → ton email Mega.nz
// MEGA_PASSWORD → ton mot de passe Mega.nz
const email = process.env.MEGA_EMAIL;
const pw    = process.env.MEGA_PASSWORD;

const upload = (fileStream, fileName) => {
  return new Promise((resolve, reject) => {
    if (!email || !pw) {
      return reject(new Error('MEGA_EMAIL et MEGA_PASSWORD non configurés.'));
    }

    const storage = new Storage({ email, password: pw });

    storage.on('ready', () => {
      const uploadStream = storage.upload({ name: fileName, allowUploadBuffering: true });
      fileStream.pipe(uploadStream);

      uploadStream.on('complete', (file) => {
        file.link((err, url) => {
          if (err) { storage.close(); return reject(err); }
          storage.close();
          resolve(url);
        });
      });

      uploadStream.on('error', (err) => { storage.close(); reject(err); });
    });

    storage.on('error', (err) => reject(err));
  });
};

module.exports = { upload };
