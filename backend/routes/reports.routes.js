const express = require('express');
const controller = require('../controllers/reports.controller');
const { asyncHandler } = require('../utils/http');
const { requirePermission } = require('../utils/auth');

const router = express.Router();
router.get('/reportes/utilidades', requirePermission('reports.read'), asyncHandler(controller.utilities));
router.get('/reportes/cuentas-por-cobrar', requirePermission('reports.read'), asyncHandler(controller.accountsReceivable));
router.get('/reportes/cuentas-por-pagar', requirePermission('reports.read'), asyncHandler(controller.accountsPayable));
router.get('/reportes/cierre-caja', requirePermission('reports.read'), asyncHandler(controller.cashClose));
router.get('/reportes/productos-inmovidos', requirePermission('reports.read'), asyncHandler(controller.dormantProducts));
router.get('/reportes/compras-proveedor', requirePermission('reports.read'), asyncHandler(controller.purchasesBySupplier));

module.exports = router;
