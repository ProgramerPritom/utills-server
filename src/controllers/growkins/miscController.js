const sheetsService = require('../../services/growkins/sheetsService');

const SHEET_SETTINGS = 'Settings';
const DEFAULT_HEADERS = ['key', 'value', 'updatedAt'];

async function getSetting(req, res, next) {
  try {
    const { type } = req.params;
    const settings = await sheetsService.getAllRows(SHEET_SETTINGS);
    const found = settings.find(s => s.key === type);

    res.json({
      success: true,
      data: found ? (typeof found.value === 'object' ? found.value : JSON.parse(found.value || '{}')) : {}
    });
  } catch (err) {
    next(err);
  }
}

async function updateSetting(req, res, next) {
  try {
    const { type } = req.params;
    const value = req.body;
    const now = new Date().toISOString();

    const settings = await sheetsService.getAllRows(SHEET_SETTINGS);
    const existing = settings.find(s => s.key === type);

    let result;
    if (existing) {
      result = await sheetsService.updateRow(SHEET_SETTINGS, 'key', type, {
        value: JSON.stringify(value),
        updatedAt: now
      });
    } else {
      result = await sheetsService.appendRow(SHEET_SETTINGS, {
        key: type,
        value: JSON.stringify(value),
        updatedAt: now
      }, DEFAULT_HEADERS);
    }

    res.json({ success: true, data: value, message: 'Settings saved successfully' });
  } catch (err) {
    next(err);
  }
}

async function getDashboardSummary(req, res, next) {
  try {
    const [products, orders] = await Promise.all([
      sheetsService.getAllRows('Products'),
      sheetsService.getAllRows('Orders')
    ]);

    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const outOfStock = products.filter(p => (p.inventory?.quantity || 0) <= 0).length;

    res.json({
      success: true,
      data: {
        totalRevenue,
        ordersCount: orders.length,
        pendingOrders,
        productsCount: products.length,
        outOfStockCount: outOfStock,
        recentOrders: orders.slice(0, 5)
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSetting,
  updateSetting,
  getDashboardSummary
};
