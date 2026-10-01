const sheetsService = require('../../services/growkins/sheetsService');
const { validateCategory } = require('./validation');

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

async function getCategoryById(req, res, next) {
  try {
    const { id } = req.params;
    const categories = await sheetsService.getAllRows(SHEET_NAME);
    const cat = categories.find(c => String(c.id) === String(id) || String(c.slug) === String(id));

    if (!cat) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, data: cat });
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const payload = req.body;
    const validation = validateCategory(payload, false);
    if (!validation.isValid) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const newCategory = {
      ...payload,
      id: payload.id || 'cat_' + Date.now().toString(36),
      slug: payload.slug || payload.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'cat',
      status: payload.status || 'active',
      productCount: Number(payload.productCount) || 0,
      sortOrder: Number(payload.sortOrder) || 0
    };

    await sheetsService.appendRow(SHEET_NAME, newCategory, DEFAULT_HEADERS);
    res.status(201).json({ success: true, data: newCategory, message: 'Category created' });
  } catch (err) {
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const payload = req.body;
    const validation = validateCategory(payload, true);
    if (!validation.isValid) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const updated = await sheetsService.updateRow(SHEET_NAME, 'id', id, payload);
    res.json({ success: true, data: updated, message: 'Category updated' });
  } catch (err) {
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    await sheetsService.deleteRow(SHEET_NAME, 'id', id);
    res.json({ success: true, data: { id }, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};
