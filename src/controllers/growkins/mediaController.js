const driveService = require('../../services/growkins/driveService');
const sheetsService = require('../../services/growkins/sheetsService');

const SHEET_NAME = 'Media';
const DEFAULT_HEADERS = ['id', 'name', 'url', 'directUrl', 'size', 'mimeType', 'createdAt'];

async function listMedia(req, res, next) {
  try {
    const mediaList = await sheetsService.getAllRows(SHEET_NAME);
    res.json({ success: true, data: mediaList });
  } catch (err) {
    next(err);
  }
}

async function uploadMedia(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const file = req.file;
    const driveResult = await driveService.uploadImageToDrive(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    const mediaRecord = {
      id: driveResult.id,
      name: file.originalname,
      url: driveResult.url,
      directUrl: driveResult.directUrl,
      size: file.size,
      mimeType: file.mimetype,
      createdAt: driveResult.createdAt
    };

    // Record in Google Sheet Media tab
    try {
      await sheetsService.appendRow(SHEET_NAME, mediaRecord, DEFAULT_HEADERS);
    } catch (sheetErr) {
      console.warn('[MediaController] Could not log media to Google Sheet:', sheetErr.message);
    }

    res.status(201).json({
      success: true,
      data: mediaRecord,
      message: 'Image uploaded to Google Drive successfully'
    });
  } catch (err) {
    next(err);
  }
}

async function deleteMedia(req, res, next) {
  try {
    const { id } = req.params;
    await driveService.deleteImageFromDrive(id);
    try {
      await sheetsService.deleteRow(SHEET_NAME, 'id', id);
    } catch {}
    res.json({ success: true, data: { id }, message: 'Media deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMedia,
  uploadMedia,
  deleteMedia
};
