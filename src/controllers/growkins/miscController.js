const sheetsService = require('../../services/growkins/sheetsService');

const SHEET_SETTINGS = 'Settings';
const DEFAULT_HEADERS = ['key', 'value', 'updatedAt'];

const DEFAULT_DELIVERY_SETTINGS = {
  zones: [
    {
      id: 'zone_dhaka',
      name: 'Inside Dhaka City',
      description: 'Covers all Dhaka Metropolitan areas',
      fee: 70,
      estimatedDelivery: '24-48 hours',
      freeDeliveryThreshold: 2500,
      active: true
    },
    {
      id: 'zone_outside',
      name: 'Outside Dhaka (All Bangladesh)',
      description: 'Chittagong, Sylhet, Rajshahi, Khulna, Barisal, Rangpur, Mymensingh',
      fee: 130,
      estimatedDelivery: '2-4 business days',
      freeDeliveryThreshold: 2500,
      active: true
    }
  ],
  standardEstimatedTime: '2-4 business days',
  codAvailableAllZones: true,
  freeDeliveryBannerEnabled: true,
  freeDeliveryThreshold: 2500,
  urgentDeliveryEnabled: false,
  urgentDeliveryFee: 150
};

const DEFAULT_STORE_SETTINGS = {
  storeName: 'GrowKins Bangladesh',
  tagline: 'Mindful Play & Organic Baby Essentials',
  hotline: '+880 1700-000000',
  email: 'support@growkins.com',
  address: 'Banani, Road 11, Dhaka-1213, Bangladesh',
  currency: 'BDT',
  currencySymbol: '৳',
  facebookUrl: 'https://facebook.com/growkins',
  instagramUrl: 'https://instagram.com/growkins'
};

const DEFAULT_CHECKOUT_SETTINGS = {
  codEnabled: true,
  phoneVerificationNotice: 'Our support team will call you within 2-4 hours to confirm your Cash on Delivery order before dispatch.',
  minOrderAmount: 0,
  orderSuccessMessage: 'Thank you for choosing GrowKins! Your order has been placed successfully.'
};

async function getSetting(req, res, next) {
  try {
    const { type } = req.params;
    const settings = await sheetsService.getAllRows(SHEET_SETTINGS);
    const found = settings.find(s => s.key === type);

    if (found) {
      const parsed = typeof found.value === 'object' ? found.value : JSON.parse(found.value || '{}');
      return res.json({ success: true, data: parsed });
    }

    if (type === 'delivery') return res.json({ success: true, data: DEFAULT_DELIVERY_SETTINGS });
    if (type === 'store') return res.json({ success: true, data: DEFAULT_STORE_SETTINGS });
    if (type === 'checkout') return res.json({ success: true, data: DEFAULT_CHECKOUT_SETTINGS });

    res.json({ success: true, data: {} });
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

    if (existing) {
      await sheetsService.updateRow(SHEET_SETTINGS, 'key', type, {
        value: typeof value === 'object' ? JSON.stringify(value) : value,
        updatedAt: now
      });
    } else {
      await sheetsService.appendRow(SHEET_SETTINGS, {
        key: type,
        value: typeof value === 'object' ? JSON.stringify(value) : value,
        updatedAt: now
      }, DEFAULT_HEADERS);
    }

    res.json({ success: true, data: value, message: 'Settings saved successfully' });
  } catch (err) {
    next(err);
  }
}

async function getDelivery(req, res, next) {
  req.params.type = 'delivery';
  return getSetting(req, res, next);
}

async function updateDelivery(req, res, next) {
  req.params.type = 'delivery';
  return updateSetting(req, res, next);
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
  getDelivery,
  updateDelivery,
  getDashboardSummary
};
