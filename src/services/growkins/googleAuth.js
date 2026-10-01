const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

let authClientInstance = null;

function getGoogleAuth() {
  if (authClientInstance) {
    return authClientInstance;
  }

  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ];

  // 1. Check GROWKINS_GOOGLE_CREDENTIALS_JSON (Full JSON from Vercel)
  if (process.env.GROWKINS_GOOGLE_CREDENTIALS_JSON) {
    try {
      const credentials = typeof process.env.GROWKINS_GOOGLE_CREDENTIALS_JSON === 'string'
        ? JSON.parse(process.env.GROWKINS_GOOGLE_CREDENTIALS_JSON)
        : process.env.GROWKINS_GOOGLE_CREDENTIALS_JSON;

      authClientInstance = new google.auth.GoogleAuth({
        credentials,
        scopes
      });
      return authClientInstance;
    } catch (e) {
      console.error('Failed to parse GROWKINS_GOOGLE_CREDENTIALS_JSON:', e);
    }
  }

  // 2. Check GROWKINS_GOOGLE_CREDENTIALS_BASE64 (Base64 string from Vercel)
  if (process.env.GROWKINS_GOOGLE_CREDENTIALS_BASE64) {
    try {
      const decoded = Buffer.from(process.env.GROWKINS_GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf8');
      const credentials = JSON.parse(decoded);
      authClientInstance = new google.auth.GoogleAuth({
        credentials,
        scopes
      });
      return authClientInstance;
    } catch (e) {
      console.error('Failed to parse GROWKINS_GOOGLE_CREDENTIALS_BASE64:', e);
    }
  }

  // 3. Check individual environment variables
  const clientEmail = process.env.GROWKINS_GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GROWKINS_GOOGLE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    // Clean potential quotes and replace escaped newlines
    let cleanKey = privateKey.trim();
    if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
      cleanKey = cleanKey.slice(1, -1);
    }
    cleanKey = cleanKey.replace(/\\n/g, '\n');

    authClientInstance = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail.trim(),
        private_key: cleanKey
      },
      scopes
    });
    return authClientInstance;
  }

  // 4. Check local JSON key file (supporting multiple local candidate names)
  const candidatePaths = [
    path.join(__dirname, '../../../growkins-credentials.json'),
    path.join(__dirname, '../../../growkins-credentials.json.json'),
    path.join(__dirname, '../../../service-account.json'),
    path.join(process.cwd(), 'growkins-credentials.json'),
    path.join(process.cwd(), 'growkins-credentials.json.json')
  ];

  for (const keyPath of candidatePaths) {
    if (fs.existsSync(keyPath)) {
      authClientInstance = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes
      });
      return authClientInstance;
    }
  }

  throw new Error(
    'GrowKins Google credentials not found! Please set GROWKINS_GOOGLE_CREDENTIALS_JSON, GROWKINS_GOOGLE_CLIENT_EMAIL & GROWKINS_GOOGLE_PRIVATE_KEY in .env, or place growkins-credentials.json in the utills-server root directory.'
  );
}

module.exports = {
  getGoogleAuth
};
