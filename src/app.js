const express = require('express');
const cors = require('cors');
require('dotenv').config();

const jobExtensionRoutes = require('./routes/jobExtensionRoutes');
const growkinsRoutes = require('./routes/growkins');

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Global Multi-Topic Express Server is running smoothly',
    timestamp: new Date().toISOString(),
    
  });
});

// Mounted Topic Routes
app.use('/api/job-extension', jobExtensionRoutes);
app.use('/api/growkins', growkinsRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route Not Found',
    path: req.originalUrl
  });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('[Global Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

module.exports = app;
