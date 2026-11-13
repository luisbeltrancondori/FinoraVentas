const express = require('express');
const controller = require('../controllers/auth.controller');
const { asyncHandler } = require('../utils/http');
const { requireAuth } = require('../utils/auth');

const router = express.Router();
router.get('/status', asyncHandler(controller.status));
router.post('/setup', asyncHandler(controller.setup));
router.post('/login', asyncHandler(controller.login));
router.post('/logout', requireAuth, controller.logout);
router.get('/me', requireAuth, asyncHandler(controller.me));
router.post('/business', requireAuth, asyncHandler(controller.switchBusiness));

module.exports = router;
