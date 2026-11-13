const express = require('express');
const controller = require('../controllers/productos.controller');
const { asyncHandler } = require('../utils/http');
const { requirePermission } = require('../utils/auth');
const { uploadProductImage } = require('../middleware/productUpload');

const router = express.Router();
router.get('/marcas', requirePermission('products.read'), asyncHandler(controller.listBrands));
router.post('/marcas', requirePermission('products.manage'), asyncHandler(controller.createBrand));
router.put('/marcas/:id', requirePermission('products.manage'), asyncHandler(controller.updateBrand));
router.delete('/marcas/:id', requirePermission('products.manage'), asyncHandler(controller.deleteBrand));
router.get('/presentaciones', requirePermission('products.read'), asyncHandler(controller.listPresentations));
router.post('/presentaciones', requirePermission('products.manage'), asyncHandler(controller.createPresentation));
router.put('/presentaciones/:id', requirePermission('products.manage'), asyncHandler(controller.updatePresentation));
router.delete('/presentaciones/:id', requirePermission('products.manage'), asyncHandler(controller.deletePresentation));
router.get('/proveedores', requirePermission('products.read'), asyncHandler(controller.listSuppliers));
router.get('/productos', requirePermission('products.read'), asyncHandler(controller.list));
router.delete('/productos/:id', requirePermission('products.manage'), asyncHandler(controller.remove));
router.post('/productos', requirePermission('products.manage'), uploadProductImage.single('imagen'), asyncHandler(controller.create));
router.put('/productos/:id', requirePermission('products.manage'), uploadProductImage.single('imagen'), asyncHandler(controller.update));

module.exports = router;
