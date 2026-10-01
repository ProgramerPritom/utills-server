// Validation Helper for GrowKins API

function validateProduct(payload, isUpdate = false) {
  const errors = {};

  if (!isUpdate && (!payload.name || typeof payload.name !== 'string' || !payload.name.trim())) {
    errors.name = ['Product title is required'];
  }

  if (payload.price !== undefined) {
    const priceNum = Number(payload.price);
    if (isNaN(priceNum) || priceNum < 0) {
      errors.price = ['Price must be a valid non-negative number'];
    }
  } else if (!isUpdate) {
    errors.price = ['Price is required'];
  }

  if (payload.compareAtPrice !== undefined && payload.compareAtPrice !== null && payload.compareAtPrice !== '') {
    const compNum = Number(payload.compareAtPrice);
    if (isNaN(compNum) || compNum < 0) {
      errors.compareAtPrice = ['Compare at price must be a valid non-negative number'];
    }
  }

  if (payload.status && !['draft', 'active', 'archived'].includes(payload.status)) {
    errors.status = ['Status must be draft, active, or archived'];
  }

  if (payload.inventory) {
    if (typeof payload.inventory === 'object') {
      if (payload.inventory.quantity !== undefined && (isNaN(Number(payload.inventory.quantity)) || Number(payload.inventory.quantity) < 0)) {
        errors.inventory = ['Inventory quantity must be a non-negative number'];
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

function validateCategory(payload, isUpdate = false) {
  const errors = {};
  if (!isUpdate && (!payload.name || typeof payload.name !== 'string' || !payload.name.trim())) {
    errors.name = ['Category name is required'];
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

function validateCollection(payload, isUpdate = false) {
  const errors = {};
  if (!isUpdate && (!payload.name || typeof payload.name !== 'string' || !payload.name.trim())) {
    errors.name = ['Collection name is required'];
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

function validateOrder(payload) {
  const errors = {};

  const customer = payload.customer || {};
  const delivery = payload.deliveryAddress || {};

  if (!customer.name && !delivery.fullName) {
    errors.name = ['Recipient / customer name is required'];
  }

  const phone = customer.phone || delivery.phone;
  if (!phone || !phone.trim()) {
    errors.phone = ['Valid contact phone number is required'];
  }

  if (!delivery.streetAddress || !delivery.streetAddress.trim()) {
    errors.streetAddress = ['Street delivery address is required'];
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    errors.items = ['At least one order line item is required'];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

module.exports = {
  validateProduct,
  validateCategory,
  validateCollection,
  validateOrder
};
