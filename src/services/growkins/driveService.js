const { google } = require('googleapis');
const { Readable } = require('stream');
const { getGoogleAuth } = require('./googleAuth');

const drive = google.drive('v3');

function getFolderId() {
  return process.env.GROWKINS_GOOGLE_DRIVE_FOLDER_ID || '1kgGRy6hy4ePhWJ4qqaNQkBZ3zlfml6V6';
}

function getAppsScriptUrl() {
  return process.env.GROWKINS_GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwHXsiJwcdZF03nXGGExnR2_ycT_Lmr1f4DBm2qkATe_jOXdXLvg1sI8aY0CBriKYgc8Q/exec';
}

/**
 * Upload image buffer to Google Drive
 * Uses Google Apps Script Web App Bridge for personal 15GB Gmail quota.
 */
async function uploadImageToDrive(fileBuffer, originalName, mimeType) {
  const folderId = getFolderId();
  const appsScriptUrl = getAppsScriptUrl();

  if (appsScriptUrl) {
    try {
      const base64Data = fileBuffer.toString('base64');
      const payload = {
        action: 'upload',
        folderId: folderId,
        fileName: `growkins_${Date.now()}_${originalName}`,
        mimeType: mimeType || 'image/jpeg',
        base64: base64Data
      };

      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

      const resData = await response.json();
      if (resData.success && resData.fileId) {
        const fileId = resData.fileId;
        const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
        return {
          id: fileId,
          name: resData.fileName || originalName,
          url: directUrl,
          directUrl,
          webViewLink: resData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
          createdAt: new Date().toISOString()
        };
      } else {
        throw new Error(resData.error || 'Unknown script error');
      }
    } catch (scriptErr) {
      console.error('[GoogleAppsScript Bridge Error]:', scriptErr.message);
      throw scriptErr;
    }
  }

  throw new Error('GROWKINS_GOOGLE_APPS_SCRIPT_URL is not configured');
}

/**
 * Delete a file from Google Drive
 * Sends delete action to Google Apps Script / Drive API to remove file from Google Drive.
 */
async function deleteImageFromDrive(fileId) {
  const appsScriptUrl = getAppsScriptUrl();

  if (appsScriptUrl && fileId) {
    try {
      const payload = {
        action: 'delete',
        fileId: fileId
      };

      await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
      console.log(`[GoogleDrive] File ${fileId} removed from Google Drive.`);
    } catch (scriptErr) {
      console.warn('[GoogleAppsScript Bridge Delete Warning]:', scriptErr.message);
    }
  }

  try {
    const auth = getGoogleAuth();
    await drive.files.delete({
      auth,
      supportsAllDrives: true,
      fileId
    });
  } catch (e) {
    // If Service Account does not have direct delete, Apps Script handles it
  }

  return { id: fileId, deleted: true };
}

module.exports = {
  uploadImageToDrive,
  deleteImageFromDrive
};
