const express = require('express');
const controller = require('../controllers/categorias.controller');
const { asyncHandler } = require('../utils/http');
const { requirePermission } = require('../utils/auth');

const router = express.Router();
router.get('/categorias', requirePermission('products.read'), asyncHandler(controller.list));
router.get('/categorias/:id', requirePermission('products.read'), asyncHandler(controller.detail));
router.post('/categorias', requirePermission('products.manage'), asyncHandler(controller.create));
router.put('/categorias/:id', requirePermission('products.manage'), asyncHandler(controller.update));
router.delete('/categorias/:id', requirePermission('products.manage'), asyncHandler(controller.remove));

module.exports = router;
