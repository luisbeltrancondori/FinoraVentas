const express = require('express');
const controller = require('../controllers/admin.controller');
const { asyncHandler } = require('../utils/http');
const { requirePermission, requireRole } = require('../utils/auth');

const router = express.Router();
router.get('/negocios', asyncHandler(controller.businesses));
router.post('/negocios', requireRole('administrador'), asyncHandler(controller.createBusiness));
router.patch('/negocios/:id', requireRole('administrador'), asyncHandler(controller.updateBusiness));
router.get('/usuarios', requireRole('administrador'), asyncHandler(controller.listUsers));
router.post('/usuarios', requireRole('administrador'), asyncHandler(controller.createUser));
router.patch('/usuarios/:id', requireRole('administrador'), asyncHandler(controller.updateUser));
router.post('/usuarios/:id/reset-password', requireRole('administrador'), asyncHandler(controller.resetUserPassword));
router.get('/perfil', asyncHandler(controller.profile));
router.patch('/perfil', asyncHandler(controller.updateProfile));
router.get('/proveedores', requirePermission('products.read'), asyncHandler(controller.suppliers));
router.post('/proveedores', requirePermission('products.manage'), asyncHandler(controller.saveSupplier));
router.patch('/proveedores/:id', requirePermission('products.manage'), asyncHandler(controller.saveSupplier));
router.delete('/proveedores/:id', requirePermission('products.manage'), asyncHandler(controller.deleteSupplier));

module.exports = router;
