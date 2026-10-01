const sheetsService = require('../../services/growkins/sheetsService');

const SHEET_CUSTOMERS = 'Customers';
const SHEET_ORDERS = 'Orders';

async function listCustomers(req, res, next) {
  try {
    const { page = 1, limit = 50, search } = req.query;

    let customers = [];
    try {
      customers = await sheetsService.getAllRows(SHEET_CUSTOMERS);
    } catch {
      customers = [];
    }

    if (customers.length === 0) {
      // Derive customers from Orders
      const orders = await sheetsService.getAllRows(SHEET_ORDERS);
      const customerMap = new Map();

      orders.forEach(o => {
        const phone = o.customer?.phone || o.deliveryAddress?.phone || '';
        const name = o.customer?.name || o.deliveryAddress?.fullName || 'Valued Customer';
        const email = o.customer?.email || '';
        const orderTotal = Number(o.total) || 0;
        const key = phone || email || name;

        if (!customerMap.has(key)) {
          customerMap.set(key, {
            id: 'cust_' + (phone ? phone.replace(/[^0-9]/g, '') : Math.random().toString(36).substring(7)),
            name,
            phone,
            email,
            totalOrders: 1,
            totalSpent: orderTotal,
            lastOrderDate: o.createdAt || new Date().toISOString(),
            status: 'active'
          });
        } else {
          const existing = customerMap.get(key);
          existing.totalOrders += 1;
          existing.totalSpent += orderTotal;
          if (new Date(o.createdAt) > new Date(existing.lastOrderDate)) {
            existing.lastOrderDate = o.createdAt;
          }
        }
      });

      customers = Array.from(customerMap.values());
    }

    if (search) {
      const q = String(search).toLowerCase();
      customers = customers.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }

    const total = customers.length;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = customers.slice(startIndex, startIndex + limitNum);

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

async function getCustomerById(req, res, next) {
  try {
    const { id } = req.params;
    let customers = [];
    try {
      customers = await sheetsService.getAllRows(SHEET_CUSTOMERS);
    } catch {}

    let customer = customers.find(c => String(c.id) === String(id));

    if (!customer) {
      const orders = await sheetsService.getAllRows(SHEET_ORDERS);
      const matchedOrders = orders.filter(o => {
        const phone = o.customer?.phone || o.deliveryAddress?.phone || '';
        return phone.includes(id) || o.customer?.name === id;
      });

      if (matchedOrders.length > 0) {
        const first = matchedOrders[0];
        customer = {
          id,
          name: first.customer?.name || first.deliveryAddress?.fullName || 'Valued Customer',
          phone: first.customer?.phone || first.deliveryAddress?.phone || '',
          email: first.customer?.email || '',
          totalOrders: matchedOrders.length,
          totalSpent: matchedOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
          lastOrderDate: matchedOrders[0].createdAt,
          orders: matchedOrders,
          status: 'active'
        };
      }
    }

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCustomers,
  getCustomerById
};
