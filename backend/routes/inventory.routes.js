const express = require('express');
const controller = require('../controllers/inventory.controller');
const { asyncHandler } = require('../utils/http');
const { requirePermission } = require('../utils/auth');

const router = express.Router();
router.get('/inventario/kardex/kpis', requirePermission('inventory.read'), asyncHandler(controller.kardexKpis));
router.get('/inventario/kardex', requirePermission('inventory.read'), asyncHandler(controller.kardex));
router.get('/inventario/ajustes', requirePermission('inventory.read'), asyncHandler(controller.listAdjustments));
router.post('/inventario/ajustes', requirePermission('inventory.write'), asyncHandler(controller.createAdjustment));
router.get('/inventario/notificaciones', requirePermission('products.read'), asyncHandler(controller.inventoryNotifications));
router.get('/inventarios-fisicos/preparar', requirePermission('inventory.read'), asyncHandler(controller.preparePhysicalInventory));
router.get('/inventarios-fisicos', requirePermission('inventory.read'), asyncHandler(controller.physicalReports));
router.post('/inventarios-fisicos', requirePermission('inventory.write'), asyncHandler(controller.physicalCount));
router.post('/inventario/fisico', requirePermission('inventory.write'), asyncHandler(controller.physicalCount));

module.exports = router;
