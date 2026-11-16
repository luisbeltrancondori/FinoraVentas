const multer = require('multer');
const { ApiError } = require('../utils/http');

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const uploadBannerImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 4, fieldSize: 10 * 1024 },
  fileFilter(_req, file, callback) {
    if (!allowedTypes.has(file.mimetype)) {
      callback(new ApiError(400, 'El banner debe ser una imagen JPG, PNG o WebP.'));
      return;
    }
    callback(null, true);
  },
});

module.exports = { uploadBannerImage };
