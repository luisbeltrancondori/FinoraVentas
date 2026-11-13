const express = require('express');
const controller = require('../controllers/public.controller');
const { asyncHandler } = require('../utils/http');

const router = express.Router();
router.get('/public/catalogo', asyncHandler(controller.catalog));
router.post('/public/contacto', asyncHandler(controller.createContactMessage));

module.exports = router;
