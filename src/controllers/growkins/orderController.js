const sheetsService = require('../../services/growkins/sheetsService');

const SHEET_NAME = 'Orders';
const DEFAULT_HEADERS = [
  'id', 'orderNumber', 'customer', 'deliveryAddress', 'items',
  'subtotal', 'deliveryFee', 'discount', 'total', 'currency',
  'paymentMethod', 'paymentStatus', 'status', 'notes', 'gift',
  'timeline', 'createdAt', 'updatedAt'
];

async function listOrders(req, res, next) {
  try {
    const { page = 1, limit = 50, search, status, paymentStatus } = req.query;
    let orders = await sheetsService.getAllRows(SHEET_NAME);

    if (search) {
      const q = String(search).toLowerCase();
      orders = orders.filter(o => 
        (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
        (o.customer?.name && o.customer.name.toLowerCase().includes(q)) ||
        (o.customer?.phone && o.customer.phone.includes(q))
      );
    }

    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    if (paymentStatus) {
      orders = orders.filter(o => o.paymentStatus === paymentStatus);
    }

    orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = orders.length;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = orders.slice(startIndex, startIndex + limitNum);

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

async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;
    const orders = await sheetsService.getAllRows(SHEET_NAME);
    const order = orders.find(o => String(o.id) === String(id) || String(o.orderNumber) === String(id));

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

async function createOrder(req, res, next) {
  try {
    const payload = req.body;
    const now = new Date().toISOString();
    const orderNum = 'GK-' + Math.floor(100000 + Math.random() * 900000);

    const initialTimeline = [
      {
        id: 'tl_1',
        status: 'pending',
        title: 'Order Placed (COD)',
        description: 'Customer submitted Cash on Delivery order',
        timestamp: now,
        actor: payload.customer?.name || 'Customer'
      }
    ];

    const newOrder = {
      ...payload,
      id: payload.id || 'ord_' + Date.now().toString(36),
      orderNumber: payload.orderNumber || orderNum,
      currency: 'BDT',
      paymentMethod: 'Cash on Delivery',
      paymentStatus: payload.paymentStatus || 'cod_pending',
      status: payload.status || 'pending',
      timeline: payload.timeline || initialTimeline,
      createdAt: now,
      updatedAt: now
    };

    await sheetsService.appendRow(SHEET_NAME, newOrder, DEFAULT_HEADERS);
    res.status(201).json({ success: true, data: newOrder, message: 'Order created successfully' });
  } catch (err) {
    next(err);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, note, actor = 'Admin' } = req.body;

    const orders = await sheetsService.getAllRows(SHEET_NAME);
    const existing = orders.find(o => String(o.id) === String(id));

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const now = new Date().toISOString();
    const currentTimeline = Array.isArray(existing.timeline) ? existing.timeline : [];
    
    currentTimeline.push({
      id: 'tl_' + Date.now().toString(36),
      status,
      title: `Status changed to ${status}`,
      description: note || '',
      timestamp: now,
      actor
    });

    const updated = await sheetsService.updateRow(SHEET_NAME, 'id', id, {
      status,
      timeline: currentTimeline,
      updatedAt: now
    });

    res.json({ success: true, data: updated, message: 'Order status updated successfully' });
  } catch (err) {
    next(err);
  }
}

async function updatePaymentStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const updated = await sheetsService.updateRow(SHEET_NAME, 'id', id, {
      paymentStatus,
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, data: updated, message: 'Payment status updated successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updatePaymentStatus
};
