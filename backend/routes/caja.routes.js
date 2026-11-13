const express = require('express');
const controller = require('../controllers/caja.controller');
const { asyncHandler } = require('../utils/http');
const { requirePermission } = require('../utils/auth');

const router = express.Router();
router.get('/turnos/actual', requirePermission('cash.read'), asyncHandler(controller.current));
router.get('/turnos', requirePermission('cash.read'), asyncHandler(controller.list));
router.post('/turnos/abrir', requirePermission('cash.write'), asyncHandler(controller.open));
router.post('/turnos/cerrar', requirePermission('cash.write'), asyncHandler(controller.close));

module.exports = router;
