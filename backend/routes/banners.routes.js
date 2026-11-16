const express = require('express');
const controller = require('../controllers/banners.controller');
const { uploadBannerImage } = require('../middleware/bannerUpload');
const { asyncHandler } = require('../utils/http');
const { requireRole } = require('../utils/auth');

const router = express.Router();
router.use(requireRole('administrador'));
router.get('/banners/configuracion/ofertas', asyncHandler(controller.getOffersDeadline));
router.put('/banners/configuracion/ofertas', asyncHandler(controller.updateOffersDeadline));
router.get('/banners/admin', asyncHandler(controller.listAdmin));
router.post('/banners', uploadBannerImage.single('imagen'), asyncHandler(controller.create));
router.put('/banners/:id', uploadBannerImage.single('imagen'), asyncHandler(controller.update));
router.delete('/banners/:id', asyncHandler(controller.remove));

module.exports = router;
