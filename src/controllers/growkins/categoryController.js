const sheetsService = require('../../services/growkins/sheetsService');

const SHEET_NAME = 'Categories';
const DEFAULT_HEADERS = ['id', 'name', 'slug', 'description', 'image', 'icon', 'productCount', 'status', 'sortOrder'];

async function listCategories(req, res, next) {
  try {
    const categories = await sheetsService.getAllRows(SHEET_NAME);
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const payload = req.body;
    const newCategory = {
      ...payload,
      id: payload.id || 'cat_' + Date.now().toString(36),
      slug: payload.slug || payload.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'cat',
      status: payload.status || 'active',
      productCount: payload.productCount || 0,
      sortOrder: payload.sortOrder || 0
    };

    await sheetsService.appendRow(SHEET_NAME, newCategory, DEFAULT_HEADERS);
    res.status(201).json({ success: true, data: newCategory });
  } catch (err) {
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await sheetsService.updateRow(SHEET_NAME, 'id', id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    await sheetsService.deleteRow(SHEET_NAME, 'id', id);
    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
