const sheetsService = require('../../services/growkins/sheetsService');
const { validateProduct } = require('./validation');

const SHEET_NAME = 'Products';
const DEFAULT_HEADERS = [
  'id', 'name', 'slug', 'subtitle', 'sku', 'tag', 'price', 'compareAtPrice',
  'currency', 'status', 'category', 'ageGroup', 'ageBadge', 'interests',
  'benefits', 'materials', 'occasions', 'description', 'storyDescription',
  'whatsInside', 'playTips', 'dimensions', 'careInstructions', 'safetyNotes',
  'inventory', 'images', 'featuredImage', 'rating', 'reviewCount', 'featured',
  'seo', 'createdAt', 'updatedAt'
];

async function listProducts(req, res, next) {
  try {
    const {
      page = 1,
      limit = 100,
      search,
      category,
      status,
      stockStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let products = await sheetsService.getAllRows(SHEET_NAME);

    // Search filter
    if (search) {
      const q = String(search).toLowerCase();
      products = products.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (category) {
      products = products.filter(p => p.category === category || (p.category && p.category.toLowerCase() === category.toLowerCase()));
    }

    // Status filter
    if (status) {
      products = products.filter(p => p.status === status);
    }

    // Stock Status
    if (stockStatus) {
      products = products.filter(p => {
        const qty = p.inventory?.quantity || 0;
        if (stockStatus === 'in_stock') return qty > 0;
        if (stockStatus === 'out_of_stock') return qty <= 0;
        if (stockStatus === 'low_stock') return qty > 0 && qty <= (p.inventory?.lowStockThreshold || 5);
        return true;
      });
    }

    // Sort
    products.sort((a, b) => {
      let valA = a[sortBy] !== undefined ? a[sortBy] : '';
      let valB = b[sortBy] !== undefined ? b[sortBy] : '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc' 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });

    const total = products.length;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = products.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      data: paginated,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    const products = await sheetsService.getAllRows(SHEET_NAME);
    const product = products.find(p => String(p.id) === String(id) || String(p.slug) === String(id));

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const payload = req.body;

    const validation = validateProduct(payload, false);
    if (!validation.isValid) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    const now = new Date().toISOString();
    const cleanSlug = payload.slug 
      ? payload.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') 
      : (payload.name ? payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'prod-' + Date.now());

    const newProduct = {
      ...payload,
      id: payload.id || 'prod_' + Date.now().toString(36),
      slug: cleanSlug,
      sku: payload.sku || 'GK-' + Math.floor(1000 + Math.random() * 9000),
      currency: payload.currency || 'BDT',
      status: payload.status || 'draft',
      price: Number(payload.price) || 0,
      compareAtPrice: payload.compareAtPrice !== undefined && payload.compareAtPrice !== '' ? Number(payload.compareAtPrice) : '',
      rating: payload.rating !== undefined ? Number(payload.rating) : 5,
      reviewCount: payload.reviewCount !== undefined ? Number(payload.reviewCount) : 0,
      createdAt: now,
      updatedAt: now
    };

    await sheetsService.appendRow(SHEET_NAME, newProduct, DEFAULT_HEADERS);
    res.status(201).json({ success: true, data: newProduct, message: 'Product created successfully' });
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const payload = req.body;

    const validation = validateProduct(payload, true);
    if (!validation.isValid) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    payload.updatedAt = new Date().toISOString();
    if (payload.price !== undefined) payload.price = Number(payload.price);
    if (payload.compareAtPrice !== undefined && payload.compareAtPrice !== '') payload.compareAtPrice = Number(payload.compareAtPrice);

    const updated = await sheetsService.updateRow(SHEET_NAME, 'id', id, payload);
    res.json({ success: true, data: updated, message: 'Product updated successfully' });
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    await sheetsService.deleteRow(SHEET_NAME, 'id', id);
    res.json({ success: true, data: { id }, message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
}

async function bulkUpdateStatus(req, res, next) {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !status) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: { ids: ['IDs array and target status are required'] }
      });
    }

    for (const id of ids) {
      await sheetsService.updateRow(SHEET_NAME, 'id', id, { status, updatedAt: new Date().toISOString() });
    }

    res.json({ success: true, data: { updatedCount: ids.length }, message: 'Products updated successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdateStatus
};
