const admin = require('firebase-admin');
const serviceAccount = require('./config/vivaq-416-firebase-adminsdk-fbsvc-3e2b310d3e.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
