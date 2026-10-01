const express = require('express');
const multer = require('multer');

// Memory storage for multer so we can directly pipe buffer to Google Drive
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

const productCtrl = require('../../controllers/growkins/productController');
const orderCtrl = require('../../controllers/growkins/orderController');
const catCtrl = require('../../controllers/growkins/categoryController');
const colCtrl = require('../../controllers/growkins/collectionController');
const mediaCtrl = require('../../controllers/growkins/mediaController');
const customerCtrl = require('../../controllers/growkins/customerController');
const reviewCtrl = require('../../controllers/growkins/reviewController');
const authCtrl = require('../../controllers/growkins/authController');
const miscCtrl = require('../../controllers/growkins/miscController');
const clothingCtrl = require('../../controllers/growkins/clothingController');

const router = express.Router();

// Health check for GrowKins
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'GrowKins Google Sheets & Drive API', timestamp: new Date().toISOString() });
});

// Define core API router
const apiRouter = express.Router();

// Auth
apiRouter.post('/auth/login', authCtrl.login);
apiRouter.get('/auth/me', authCtrl.getMe);
apiRouter.post('/auth/logout', authCtrl.logout);
apiRouter.post('/auth/refresh', authCtrl.refresh);

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
apiRouter.get('/categories/:id', catCtrl.getCategoryById);
apiRouter.patch('/categories/:id', catCtrl.updateCategory);
apiRouter.delete('/categories/:id', catCtrl.deleteCategory);

// Collections
apiRouter.get('/collections', colCtrl.listCollections);
apiRouter.post('/collections', colCtrl.createCollection);
apiRouter.get('/collections/:id', colCtrl.getCollectionById);
apiRouter.patch('/collections/:id', colCtrl.updateCollection);
apiRouter.delete('/collections/:id', colCtrl.deleteCollection);

// Customers
apiRouter.get('/customers', customerCtrl.listCustomers);
apiRouter.get('/customers/:id', customerCtrl.getCustomerById);

// Reviews
apiRouter.get('/reviews', reviewCtrl.listReviews);
apiRouter.get('/reviews/:id', reviewCtrl.getReviewById);
apiRouter.patch('/reviews/:id/status', reviewCtrl.updateReviewStatus);
apiRouter.delete('/reviews/:id', reviewCtrl.deleteReview);

// Media (Google Drive Upload & Delete)
apiRouter.get('/media', mediaCtrl.listMedia);
apiRouter.post('/media/upload', upload.single('file'), mediaCtrl.uploadMedia);
apiRouter.delete('/media/:id', mediaCtrl.deleteMedia);

// Clothing Routes
apiRouter.get('/clothing/products', clothingCtrl.getProducts);
apiRouter.get('/clothing/categories', clothingCtrl.getCategories);
apiRouter.get('/clothing/collections', clothingCtrl.getCollections);
apiRouter.get('/clothing/lookbooks', clothingCtrl.getLooks);
apiRouter.get('/clothing/size-guides', clothingCtrl.getSizeGuides);

// Delivery Settings Direct Routes
apiRouter.get('/delivery', miscCtrl.getDelivery);
apiRouter.patch('/delivery', miscCtrl.updateDelivery);

// Settings & Content
apiRouter.get('/settings/:type', miscCtrl.getSetting);
apiRouter.patch('/settings/:type', miscCtrl.updateSetting);
apiRouter.get('/content/:type', miscCtrl.getSetting);
apiRouter.patch('/content/:type', miscCtrl.updateSetting);

// Dashboard
apiRouter.get('/dashboard/summary', miscCtrl.getDashboardSummary);

// Mount so direct paths, /admin, and /api/admin all resolve seamlessly
router.use('/', apiRouter);
router.use('/admin', apiRouter);
router.use('/api/admin', apiRouter);

module.exports = router;
