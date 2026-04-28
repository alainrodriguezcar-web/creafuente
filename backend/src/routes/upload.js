const express = require('express');
const multer = require('multer');
const router = express.Router();
const { extractGlyphsFromTemplate } = require('../services/imageProcessor');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|tiff|webp)/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan imágenes JPG, PNG, TIFF o WEBP.'));
    }
  },
});

// POST /api/upload/template
router.post('/template', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });

    console.log(`[UPLOAD] Procesando plantilla escaneada (${(req.file.size / 1024).toFixed(0)} KB)`);
    const glyphs = await extractGlyphsFromTemplate(req.file.buffer);

    res.json({
      glyphCount: Object.keys(glyphs).length,
      glyphs,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
