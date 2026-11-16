const express = require('express');
const controller = require('../controllers/public.controller');
const bannersController = require('../controllers/banners.controller');
const proformasController = require('../controllers/proformas-web.controller');
const { asyncHandler } = require('../utils/http');

const router = express.Router();
router.get('/public/catalogo', asyncHandler(controller.catalog));
router.post('/public/contacto', asyncHandler(controller.createContactMessage));
router.post('/proformas-web', asyncHandler(proformasController.create));
router.get('/banners', asyncHandler(bannersController.listPublic));
router.get('/public/ofertas-vencimiento', asyncHandler(bannersController.getPublicOffersDeadline));

module.exports = router;
