const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

let authClientInstance = null;

function getGoogleAuth() {
  if (authClientInstance) {
    return authClientInstance;
  }

  const clientEmail = process.env.GROWKINS_GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GROWKINS_GOOGLE_PRIVATE_KEY;

  // 1. Check environment variables
  if (clientEmail && privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
    authClientInstance = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ]
    );
    return authClientInstance;
  }

  // 2. Check local JSON key file (supporting either .json or .json.json)
  const candidatePaths = [
    path.join(__dirname, '../../../growkins-credentials.json'),
    path.join(__dirname, '../../../growkins-credentials.json.json')
  ];

  for (const keyPath of candidatePaths) {
    if (fs.existsSync(keyPath)) {
      authClientInstance = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive'
        ]
      });
      return authClientInstance;
    }
  }

  throw new Error(
    'GrowKins Google credentials not found! Please set GROWKINS_GOOGLE_CLIENT_EMAIL and GROWKINS_GOOGLE_PRIVATE_KEY in .env, or place growkins-credentials.json in the utills-server root directory.'
  );
}

module.exports = {
  getGoogleAuth
};
