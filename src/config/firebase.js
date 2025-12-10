const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('../path-to-your-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://your-project-id.firebaseio.com'
});

const db = admin.firestore();
const messaging = admin.messaging();

// Firestore collections
const collections = {
  USERS: 'users',
  DEVICES: 'devices',
  AUTH_CHALLENGES: 'authChallenges',
  TOTP_SECRETS: 'totpSecrets'
};

module.exports = {
  admin,
  db,
  messaging,
  collections
};