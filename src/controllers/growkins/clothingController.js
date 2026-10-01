// Clothing Controller for GrowKins
const sheetsService = require('../../services/growkins/sheetsService');

async function getProducts(req, res, next) {
  try {
    const products = await sheetsService.getAllRows('Products');
    // Filter apparel or return all products
    const apparel = products.filter(p => p.category === 'Apparel & Rompers' || p.category?.toLowerCase().includes('apparel') || Array.isArray(p.images));
    res.json({
      success: true,
      products: apparel.length > 0 ? apparel : products,
      total: apparel.length > 0 ? apparel.length : products.length
    });
  } catch (err) {
    next(err);
  }
}

async function getCategories(req, res, next) {
  try {
    const categories = await sheetsService.getAllRows('Categories');
    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
}

async function getCollections(req, res, next) {
  try {
    const collections = await sheetsService.getAllRows('Collections');
    res.json({ success: true, data: collections });
  } catch (err) {
    next(err);
  }
}

async function getLooks(req, res, next) {
  res.json({ success: true, data: [] });
}

async function getSizeGuides(req, res, next) {
  res.json({ success: true, data: [] });
}

module.exports = {
  getProducts,
  getCategories,
  getCollections,
  getLooks,
  getSizeGuides
};
