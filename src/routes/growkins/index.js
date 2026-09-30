const express = require('express');
const multer = require('multer');

// Memory storage for multer so we can directly pipe buffer to Google Drive
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const productCtrl = require('../../controllers/growkins/productController');
const orderCtrl = require('../../controllers/growkins/orderController');
const catCtrl = require('../../controllers/growkins/categoryController');
const colCtrl = require('../../controllers/growkins/collectionController');
const mediaCtrl = require('../../controllers/growkins/mediaController');
const miscCtrl = require('../../controllers/growkins/miscController');

const router = express.Router();

// Health check for GrowKins
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'GrowKins Google Sheets & Drive API', timestamp: new Date().toISOString() });
});

// Define core API routes
const apiRouter = express.Router();

// Products
apiRouter.get('/products', productCtrl.listProducts);
apiRouter.post('/products', productCtrl.createProduct);
apiRouter.get('/products/:id', productCtrl.getProductById);
apiRouter.patch('/products/:id', productCtrl.updateProduct);
apiRouter.delete('/products/:id', productCtrl.deleteProduct);
apiRouter.post('/products/bulk-status', productCtrl.bulkUpdateStatus);

// Orders
apiRouter.get('/orders', orderCtrl.listOrders);
apiRouter.post('/orders', orderCtrl.createOrder);
apiRouter.get('/orders/:id', orderCtrl.getOrderById);
apiRouter.patch('/orders/:id/status', orderCtrl.updateOrderStatus);
apiRouter.patch('/orders/:id/payment', orderCtrl.updatePaymentStatus);

// Categories
apiRouter.get('/categories', catCtrl.listCategories);
apiRouter.post('/categories', catCtrl.createCategory);
apiRouter.patch('/categories/:id', catCtrl.updateCategory);
apiRouter.delete('/categories/:id', catCtrl.deleteCategory);

// Collections
apiRouter.get('/collections', colCtrl.listCollections);
apiRouter.post('/collections', colCtrl.createCollection);
apiRouter.patch('/collections/:id', colCtrl.updateCollection);
apiRouter.delete('/collections/:id', colCtrl.deleteCollection);

// Media (Google Drive Upload)
apiRouter.get('/media', mediaCtrl.listMedia);
apiRouter.post('/media/upload', upload.single('file'), mediaCtrl.uploadMedia);
apiRouter.delete('/media/:id', mediaCtrl.deleteMedia);

// Settings & Content
apiRouter.get('/settings/:type', miscCtrl.getSetting);
apiRouter.patch('/settings/:type', miscCtrl.updateSetting);
apiRouter.get('/content/:type', miscCtrl.getSetting);
apiRouter.patch('/content/:type', miscCtrl.updateSetting);

// Dashboard
apiRouter.get('/dashboard/summary', miscCtrl.getDashboardSummary);

// Mount so both direct paths (/products) and admin paths (/api/admin/products or /admin/products) work
router.use('/', apiRouter);
router.use('/admin', apiRouter);
router.use('/api/admin', apiRouter);

module.exports = router;
