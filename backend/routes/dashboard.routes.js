const express = require('express');
const { salesTime, summary, health } = require('../controllers/dashboard.controller');
const { asyncHandler } = require('../utils/http');
const { requireAuth, requirePermission } = require('../utils/auth');

const router = express.Router();
router.get('/health', asyncHandler(health));
router.get('/dashboard/resumen', requireAuth, requirePermission('dashboard.read'), asyncHandler(summary));
router.get('/dashboard/ventas-tiempo', requireAuth, requirePermission('dashboard.read'), asyncHandler(salesTime));
router.get('/dashboard', requireAuth, requirePermission('dashboard.read'), asyncHandler(summary));

module.exports = router;
