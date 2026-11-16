const express = require('express');
const controller = require('../controllers/ventas.controller');
const { asyncHandler } = require('../utils/http');
const { requirePermission } = require('../utils/auth');
const clientsController = require('../controllers/clientes.controller');
const proformasController = require('../controllers/proformas-web.controller');

const router = express.Router();
router.get('/clientes', requirePermission('sales.read'), asyncHandler(clientsController.list));
router.get('/clientes/:id', requirePermission('sales.read'), asyncHandler(clientsController.detail));
router.post('/clientes', requirePermission('sales.write'), asyncHandler(clientsController.create));
router.put('/clientes/:id', requirePermission('sales.write'), asyncHandler(clientsController.update));
router.delete('/clientes/:id', requirePermission('sales.write'), asyncHandler(clientsController.remove));
router.get('/ventas', requirePermission('sales.read'), asyncHandler(controller.list));
router.get('/ventas/:id', requirePermission('sales.read'), asyncHandler(controller.detail));
router.post('/ventas/:id/pagos', requirePermission('sales.write'), asyncHandler(controller.registerPayment));
router.post('/ventas', requirePermission('sales.write'), asyncHandler(controller.create));
router.put('/ventas/:id', requirePermission('sales.write'), asyncHandler(controller.update));
router.delete('/ventas/:id', requirePermission('sales.write'), asyncHandler(controller.cancel));
router.get('/proformas-web', requirePermission('sales.read'), asyncHandler(proformasController.list));
router.post('/proformas-web/:id/convertir-venta', requirePermission('sales.write'), asyncHandler(proformasController.convertToSale));

module.exports = router;
