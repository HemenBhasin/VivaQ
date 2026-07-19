const admin = require('firebase-admin');

let serviceAccount;
try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is missing.");
  }
  // Remove any accidental leading/trailing whitespace before parsing
  const rawJSON = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
  serviceAccount = JSON.parse(rawJSON);
} catch (error) {
  console.error('\n❌ FATAL ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT.');
  console.error('Make sure you pasted the ENTIRE JSON string (with the { and }) exactly as it appears in the .env file.');
  console.error('Specific error:', error.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
