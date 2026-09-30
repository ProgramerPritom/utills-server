const sheetsService = require('../../services/growkins/sheetsService');

const SHEET_NAME = 'Collections';
const DEFAULT_HEADERS = ['id', 'name', 'slug', 'description', 'image', 'badge', 'productIds', 'status', 'sortOrder'];

async function listCollections(req, res, next) {
  try {
    const collections = await sheetsService.getAllRows(SHEET_NAME);
    res.json({ success: true, data: collections });
  } catch (err) {
    next(err);
  }
}

async function createCollection(req, res, next) {
  try {
    const payload = req.body;
    const newCol = {
      ...payload,
      id: payload.id || 'col_' + Date.now().toString(36),
      slug: payload.slug || payload.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'col',
      productIds: payload.productIds || [],
      status: payload.status || 'active',
      sortOrder: payload.sortOrder || 0
    };

    await sheetsService.appendRow(SHEET_NAME, newCol, DEFAULT_HEADERS);
    res.status(201).json({ success: true, data: newCol });
  } catch (err) {
    next(err);
  }
}

async function updateCollection(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await sheetsService.updateRow(SHEET_NAME, 'id', id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function deleteCollection(req, res, next) {
  try {
    const { id } = req.params;
    await sheetsService.deleteRow(SHEET_NAME, 'id', id);
    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection
};
