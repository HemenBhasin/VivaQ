const admin = require('firebase-admin');
const serviceAccount = require('./config/vivaq-416-firebase-adminsdk-fbsvc-36a9787496.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
