const express = require('express');
const router = express.Router();
const { buildFont } = require('../services/fontBuilder');
const { saveFont, getFont, listFonts, deleteFont } = require('../services/db');

// POST /api/fonts/generate
// Body: { glyphs: { "A": "data:image/png;base64,..." }, fontName: string, format: "otf"|"ttf" }
router.post('/generate', async (req, res, next) => {
  try {
    const { glyphs, fontName = 'MiLetra', format = 'otf' } = req.body;

    if (!glyphs || typeof glyphs !== 'object' || Object.keys(glyphs).length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un glifo.' });
    }
    if (!['otf', 'ttf'].includes(format)) {
      return res.status(400).json({ error: 'Formato inválido. Usa "otf" o "ttf".' });
    }
    if (fontName.length > 64) {
      return res.status(400).json({ error: 'El nombre de la fuente no puede superar 64 caracteres.' });
    }

    console.log(`[FONTS] Generando "${fontName}.${format}" con ${Object.keys(glyphs).length} glifos`);

    const { buffer, glyphCount, errors } = await buildFont(glyphs, fontName, format);

    // Guardar en DB
    const saved = await saveFont({
      name: fontName,
      format,
      glyphCount,
      fileData: buffer,
    });

    res.json({
      id: saved.id,
      name: saved.name,
      format: saved.format,
      glyphCount: saved.glyph_count,
      createdAt: saved.created_at,
      errors: errors.length > 0 ? errors : undefined,
      downloadUrl: `/api/fonts/${saved.id}/download`,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/fonts – lista fuentes generadas
router.get('/', async (req, res, next) => {
  try {
    const fonts = await listFonts(20);
    res.json(fonts);
  } catch (err) {
    next(err);
  }
});

// GET /api/fonts/:id/download – descarga el archivo
router.get('/:id/download', async (req, res, next) => {
  try {
    const font = await getFont(req.params.id);
    if (!font) return res.status(404).json({ error: 'Fuente no encontrada.' });

    const mime = font.format === 'otf' ? 'font/otf' : 'font/ttf';
    res.set('Content-Type', mime);
    res.set('Content-Disposition', `attachment; filename="${font.name}.${font.format}"`);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(font.file_data);
  } catch (err) {
    next(err);
  }
});

// GET /api/fonts/:id – metadata
router.get('/:id', async (req, res, next) => {
  try {
    const font = await getFont(req.params.id);
    if (!font) return res.status(404).json({ error: 'Fuente no encontrada.' });
    const { file_data, ...meta } = font;
    res.json(meta);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/fonts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await deleteFont(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Fuente no encontrada.' });
    res.json({ message: 'Fuente eliminada correctamente.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
