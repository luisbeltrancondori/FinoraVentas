const express = require('express');
const controller = require('../controllers/compras.controller');
const { asyncHandler } = require('../utils/http');
const { requirePermission } = require('../utils/auth');

const router = express.Router();
router.get('/compras/sugerido', requirePermission('purchases.read'), asyncHandler(controller.suggested));
router.get('/compras', requirePermission('purchases.read'), asyncHandler(controller.list));
router.get('/compras/:id', requirePermission('purchases.read'), asyncHandler(controller.detail));
router.post('/compras/:id/pagos', requirePermission('purchases.write'), asyncHandler(controller.registerPayment));
router.post('/compras/:id/anular', requirePermission('purchases.write'), asyncHandler(controller.cancel));
router.post('/compras', requirePermission('purchases.write'), asyncHandler(controller.create));
router.put('/compras/:id', requirePermission('purchases.write'), asyncHandler(controller.update));
router.delete('/compras/:id', requirePermission('purchases.write'), asyncHandler(controller.remove));

module.exports = router;
