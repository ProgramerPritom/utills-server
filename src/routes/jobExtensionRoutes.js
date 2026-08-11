const express = require('express');
const router = express.Router();
const jobExtensionController = require('../controllers/jobExtensionController');

/**
 * Route: Generate Cold Application Email
 * POST /api/job-extension/generate-email
 */
router.post('/generate-email', jobExtensionController.generateEmail);

/**
 * Route: Generate Technical Interview Preparation Guide
 * POST /api/job-extension/generate-interview-prep
 */
router.post('/generate-interview-prep', jobExtensionController.generateInterviewPrep);

/**
 * Route: Parse Job Post & Evaluate Candidate CV Match
 * POST /api/job-extension/parse-job', jobExtensionController.parseJob
 */
router.post('/parse-job', jobExtensionController.parseJob);

module.exports = router;
