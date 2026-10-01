const sheetsService = require('../../services/growkins/sheetsService');
const { validateCollection } = require('./validation');

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

async function getCollectionById(req, res, next) {
  try {
    const { id } = req.params;
    const collections = await sheetsService.getAllRows(SHEET_NAME);
    const col = collections.find(c => String(c.id) === String(id) || String(c.slug) === String(id));

    if (!col) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }
    res.json({ success: true, data: col });
  } catch (err) {
    next(err);
  }
}

async function createCollection(req, res, next) {
  try {
    const payload = req.body;
    const validation = validateCollection(payload, false);
    if (!validation.isValid) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const newCol = {
      ...payload,
      id: payload.id || 'col_' + Date.now().toString(36),
      slug: payload.slug || payload.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'col',
      productIds: Array.isArray(payload.productIds) ? payload.productIds : [],
      status: payload.status || 'active',
      sortOrder: Number(payload.sortOrder) || 0
    };

    await sheetsService.appendRow(SHEET_NAME, newCol, DEFAULT_HEADERS);
    res.status(201).json({ success: true, data: newCol, message: 'Collection created' });
  } catch (err) {
    next(err);
  }
}

async function updateCollection(req, res, next) {
  try {
    const { id } = req.params;
    const payload = req.body;
    const validation = validateCollection(payload, true);
    if (!validation.isValid) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const updated = await sheetsService.updateRow(SHEET_NAME, 'id', id, payload);
    res.json({ success: true, data: updated, message: 'Collection updated' });
  } catch (err) {
    next(err);
  }
}

async function deleteCollection(req, res, next) {
  try {
    const { id } = req.params;
    await sheetsService.deleteRow(SHEET_NAME, 'id', id);
    res.json({ success: true, data: { id }, message: 'Collection deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCollections,
  getCollectionById,
  createCollection,
  updateCollection,
  deleteCollection
};
