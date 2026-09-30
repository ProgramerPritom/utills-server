const { google } = require('googleapis');
const { Readable } = require('stream');
const { getGoogleAuth } = require('./googleAuth');

const drive = google.drive('v3');

function getFolderId() {
  return process.env.GROWKINS_GOOGLE_DRIVE_FOLDER_ID || null;
}

/**
 * Upload image buffer to Google Drive and make it publicly readable
 */
async function uploadImageToDrive(fileBuffer, originalName, mimeType) {
  const auth = getGoogleAuth();
  const folderId = getFolderId();

  const fileMetadata = {
    name: `growkins_${Date.now()}_${originalName}`,
    parents: folderId ? [folderId] : []
  };

  const bufferStream = new Readable();
  bufferStream.push(fileBuffer);
  bufferStream.push(null);

  const media = {
    mimeType: mimeType || 'image/jpeg',
    body: bufferStream
  };

  const response = await drive.files.create({
    auth,
    resource: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink, webContentLink'
  });

  const fileId = response.data.id;

  // Make file publicly readable
  try {
    await drive.permissions.create({
      auth,
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
  } catch (permErr) {
    console.warn('[GoogleDrive] Could not set public permission:', permErr.message);
  }

  // High-speed direct thumbnail CDN link
  const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

  return {
    id: fileId,
    name: response.data.name,
    url: directUrl,
    directUrl,
    webViewLink: response.data.webViewLink,
    createdAt: new Date().toISOString()
  };
}

/**
 * Delete a file from Google Drive
 */
async function deleteImageFromDrive(fileId) {
  const auth = getGoogleAuth();
  await drive.files.delete({
    auth,
    fileId
  });
  return { id: fileId, deleted: true };
}

module.exports = {
  uploadImageToDrive,
  deleteImageFromDrive
};
